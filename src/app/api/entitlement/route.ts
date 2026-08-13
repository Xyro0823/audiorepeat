import { NextResponse } from 'next/server';
import { createEntitlementStore, isAdminConfigured, verifyIdToken } from '@/lib/firebase/admin';
import { toPublicEntitlement } from '@/lib/stripe/entitlements';

export const runtime = 'nodejs';

/**
 * Return the authenticated user's server-side entitlement — the source of
 * truth for Pro/Lifetime access. The client mirrors this into local settings
 * (e.g. after checkout, or on sign-in), but the record itself lives here.
 *
 * - no/invalid token → 401
 * - admin layer not configured → 503 (client keeps its local state)
 */
export async function GET(request: Request) {
  if (!isAdminConfigured()) {
    return NextResponse.json({ error: 'server-not-configured' }, { status: 503 });
  }

  const auth = request.headers.get('authorization');
  const token = auth?.startsWith('Bearer ') ? auth.slice('Bearer '.length).trim() : null;
  if (!token) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }
  const uid = await verifyIdToken(token);
  if (!uid) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  const record = await createEntitlementStore().getEntitlement(uid);
  return NextResponse.json(toPublicEntitlement(record));
}
