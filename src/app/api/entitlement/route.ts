import { NextResponse } from 'next/server';
import { createEntitlementStore, isAdminConfigured, verifyIdToken } from '@/lib/firebase/admin';
import {
  effectiveEntitlementView,
  toPublicEntitlement,
  type EntitlementRecord,
} from '@/lib/stripe/entitlements';
import { NO_STORE_HEADERS } from '@/lib/http';

export const runtime = 'nodejs';

/**
 * Return the authenticated user's server-side entitlement — the source of
 * truth for Pro/Lifetime access. The client mirrors this into local settings
 * (e.g. after checkout, or on sign-in), but the record itself lives here.
 *
 * The response is the *effective* entitlement computed with strongest-valid
 * semantics (Lifetime > active manual gift > active provider subscription >
 * Free) and manual-grant expiry is evaluated at read time. `source` tells the
 * client whether the plan comes from a manual gift ('manual') or verified
 * billing ('paddle').
 *
 * - no/invalid token → 401
 * - admin layer not configured → 503 (client keeps its local state)
 */
export async function GET(request: Request) {
  if (!isAdminConfigured()) {
    return NextResponse.json(
      { error: 'server-not-configured' },
      { status: 503, headers: NO_STORE_HEADERS },
    );
  }

  const auth = request.headers.get('authorization');
  const token = auth?.startsWith('Bearer ') ? auth.slice('Bearer '.length).trim() : null;
  if (!token) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401, headers: NO_STORE_HEADERS });
  }
  const uid = await verifyIdToken(token);
  if (!uid) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401, headers: NO_STORE_HEADERS });
  }

  const record = await createEntitlementStore().getEntitlement(uid);
  const nowSec = Math.floor(Date.now() / 1000);
  const view = effectiveEntitlementView(record, nowSec);

  return NextResponse.json(
    {
      ...toPublicEntitlement({ ...record, ...view } as EntitlementRecord),
      source: view.source,
      manualExpiresAt: view.manualExpiresAt,
    },
    { headers: NO_STORE_HEADERS },
  );
}
