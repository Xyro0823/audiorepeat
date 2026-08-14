import { NextResponse } from 'next/server';
import {
  createEntitlementStore,
  getAdminAuth,
  verifyAdminRequest,
} from '@/lib/firebase/admin';
import { effectiveEntitlementView, providerPlanOf } from '@/lib/stripe/entitlements';
import type { PlanId } from '@/lib/plans';

export const runtime = 'nodejs';

/**
 * GET /api/admin/users/lookup?email=...  OR  ?uid=...
 *
 * Server-only admin lookup: the caller must be on the `ADMIN_UIDS` allowlist
 * (verified via Firebase ID token). Lookup happens server-side with
 * firebase-admin — the browser never talks to Firebase directly here.
 *
 * Returns ONLY minimal, non-sensitive fields (uid/email/displayName/photoURL)
 * plus the target's entitlement summary so the admin page can show an account
 * card before granting. Never exposes passwords, providers, or credential
 * material. An unknown email/uid → 404 (safe).
 */
export async function GET(request: Request) {
  const auth = await verifyAdminRequest(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const url = new URL(request.url);
  const email = url.searchParams.get('email')?.trim().toLowerCase() ?? '';
  const uid = url.searchParams.get('uid')?.trim() ?? '';
  if ((email && uid) || (!email && !uid)) {
    return NextResponse.json({ error: 'invalid-query' }, { status: 400 });
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'invalid-query' }, { status: 400 });
  }

  let record: { uid: string; email?: string; displayName?: string; photoURL?: string };
  try {
    if (email) {
      record = await getAdminAuth().getUserByEmail(email);
    } else {
      record = await getAdminAuth().getUser(uid);
    }
  } catch (err) {
    const code = (err as { code?: string })?.code;
    // firebase-admin reports unknown users as auth/user-not-found.
    if (code === 'auth/user-not-found') {
      return NextResponse.json({ error: 'user-not-found' }, { status: 404 });
    }
    console.error('[admin/lookup] failed:', code ?? err);
    return NextResponse.json({ error: 'lookup-failed' }, { status: 500 });
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const store = createEntitlementStore();
  const entitlementRecord = await store.getEntitlement(record.uid);
  const view = effectiveEntitlementView(entitlementRecord, nowSec);
  const providerPlan: PlanId = providerPlanOf(entitlementRecord, nowSec);

  return NextResponse.json({
    ok: true,
    user: {
      uid: record.uid,
      email: record.email ?? null,
      displayName: record.displayName ?? null,
      photoURL: record.photoURL ?? null,
    },
    entitlement: {
      plan: view.plan,
      source: view.source,
      manualExpiresAt: view.manualExpiresAt,
      manual: entitlementRecord?.manual
        ? {
            plan: entitlementRecord.manual.plan,
            expiresAt: entitlementRecord.manual.expiresAt,
            revoked: entitlementRecord.manual.revokedAt !== null,
          }
        : null,
      providerPlan,
    },
  });
}
