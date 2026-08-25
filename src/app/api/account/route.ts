import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb, isAdminConfigured, verifyIdToken } from '@/lib/firebase/admin';
import {
  LIVE_PADDLE_SUBSCRIPTION_STATUSES,
  cancelPaddleSubscriptionNow,
  isPaddleConfigured,
} from '@/lib/paddle/server';
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

    // ---- billing safety: never orphan a live Paddle subscription ----
    // Active/trialing/past_due/grace/paused subscriptions must be VERIFIED
    // canceled BEFORE any data is deleted; a failed cancellation fails closed
    // (409 — account and data are kept). 'canceled' subscriptions need no
    // action. Lifetime purchases carry no subscription id and pass through.
    if (record?.paddleSubscriptionId && LIVE_PADDLE_SUBSCRIPTION_STATUSES.has(record.status ?? '')) {
      if (!isPaddleConfigured()) {
        return NextResponse.json(
          { error: 'Cancel your subscription before deleting your account (billing is not configurable on this server).' },
          { status: 409, headers: NO_STORE_HEADERS },
        );
      }
      const result = await cancelPaddleSubscriptionNow(record.paddleSubscriptionId);
      if (result !== 'canceled') {
        return NextResponse.json(
          { error: 'We could not cancel your subscription, so your account was not deleted. Please try again or contact support.' },
          { status: 409, headers: NO_STORE_HEADERS },
        );
      }
      // Record the verified cancellation locally so a delayed/lost webhook
      // can't resurrect Pro on an account whose owner already deleted it.
      // The authoritative webhook still applies afterwards (idempotent,
      // ordering-guarded by paddleEventAt).
      await entitlementRef.set(
        { status: 'canceled', paddleCanceledAt: Date.now() },
        { merge: true },
      );
    }

    // Stripe subscriptions keep the hard block: there is no server-side
    // cancellation path wired for them yet, so fail closed.
    const stripeActive =
      (record?.status === 'active' || record?.status === 'trialing') &&
      Boolean(record?.stripeSubscriptionId);
    if (stripeActive) {
      return NextResponse.json(
        { error: 'Cancel your active subscription before deleting your account.' },
        { status: 409, headers: NO_STORE_HEADERS },
      );
    }

    const auth = getAdminAuth();
    const user = await auth.getUser(uid);
    const userDataRef = db.doc(`users/${uid}`);
    const [interest, purchases, syncedSets, syncMeta, userData] = await Promise.all([
      db.collection('plan_interest').where('userId', '==', uid).get(),
      db.collection('plan_purchases').where('userId', '==', uid).get(),
      db.collection(`users/${uid}/sets`).get(),
      db.collection(`users/${uid}/sync`).get(),
      userDataRef.get(),
    ]);
    const newsletterRef = user.email
      ? db.doc(`newsletter_subscribers/${user.email.trim().toLowerCase()}`)
      : null;
    const newsletter = newsletterRef ? await newsletterRef.get() : null;
    const snapshots = [
      entitlement,
      userData,
      ...syncedSets.docs,
      ...syncMeta.docs,
      ...interest.docs,
      ...purchases.docs,
      ...(newsletter ? [newsletter] : []),
    ]
      .filter((snapshot) => snapshot.exists !== false && snapshot.data())
      .map((snapshot) => ({ ref: snapshot.ref ?? entitlementRef, data: snapshot.data() }));
    const batch = db.batch();
    // If we verified-canceled above, the rollback copy must reflect it —
    // never restore a stale 'active' status after an Auth-delete failure.
    for (const snapshot of snapshots) {
      if (snapshot.ref.path === entitlementRef.path) {
        snapshot.data = { ...snapshot.data, status: 'canceled', paddleCanceledAt: Date.now() };
      }
    }
    batch.delete(entitlementRef);
    for (const doc of interest.docs) batch.delete(doc.ref);
    for (const doc of purchases.docs) batch.delete(doc.ref);
    for (const doc of syncedSets.docs) batch.delete(doc.ref);
    for (const doc of syncMeta.docs) batch.delete(doc.ref);
    batch.delete(userDataRef);
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
