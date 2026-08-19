import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb, isAdminConfigured, verifyIdToken } from '@/lib/firebase/admin';
import { NO_STORE_HEADERS } from '@/lib/http';

export const runtime = 'nodejs';

function bearerToken(request: Request): string | null {
  const auth = request.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  return auth.slice('Bearer '.length).trim() || null;
}

/** Delete the authenticated account and its user-linked server records. */
export async function DELETE(request: Request) {
  if (!isAdminConfigured()) {
    return NextResponse.json({ error: 'server-not-configured' }, { status: 503, headers: NO_STORE_HEADERS });
  }
  const token = bearerToken(request);
  const uid = token ? await verifyIdToken(token) : null;
  if (!uid) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401, headers: NO_STORE_HEADERS });
  }

  try {
    const db = getAdminDb();
    const entitlementRef = db.doc(`entitlements/${uid}`);
    const entitlement = await entitlementRef.get();
    const record = entitlement.data() as { status?: string; stripeSubscriptionId?: string | null; paddleSubscriptionId?: string | null } | undefined;
    const active = record?.status === 'active' || record?.status === 'trialing';
    if (active && (record?.stripeSubscriptionId || record?.paddleSubscriptionId)) {
      return NextResponse.json(
        { error: 'Cancel your active subscription before deleting your account.' },
        { status: 409, headers: NO_STORE_HEADERS },
      );
    }

    const auth = getAdminAuth();
    const user = await auth.getUser(uid);
    const [interest, purchases] = await Promise.all([
      db.collection('plan_interest').where('userId', '==', uid).get(),
      db.collection('plan_purchases').where('userId', '==', uid).get(),
    ]);
    const newsletterRef = user.email
      ? db.doc(`newsletter_subscribers/${user.email.trim().toLowerCase()}`)
      : null;
    const newsletter = newsletterRef ? await newsletterRef.get() : null;
    const snapshots = [entitlement, ...interest.docs, ...purchases.docs, ...(newsletter ? [newsletter] : [])]
      .filter((snapshot) => snapshot.exists !== false && snapshot.data())
      .map((snapshot) => ({ ref: snapshot.ref ?? entitlementRef, data: snapshot.data() }));
    const batch = db.batch();
    batch.delete(entitlementRef);
    for (const doc of interest.docs) batch.delete(doc.ref);
    for (const doc of purchases.docs) batch.delete(doc.ref);
    if (newsletterRef) batch.delete(newsletterRef);
    await batch.commit();
    try {
      await auth.deleteUser(uid);
    } catch (error) {
      // Cross-service operations cannot share one transaction. Compensate if
      // Auth deletion fails so the still-existing account keeps its records.
      const rollback = db.batch();
      for (const snapshot of snapshots) rollback.set(snapshot.ref, snapshot.data);
      await rollback.commit();
      throw error;
    }
    return NextResponse.json({ deleted: true }, { headers: NO_STORE_HEADERS });
  } catch (error) {
    console.error('[account-delete] failed', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'Could not delete your account.' }, { status: 500, headers: NO_STORE_HEADERS });
  }
}
