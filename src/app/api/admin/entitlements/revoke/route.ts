import { NextResponse } from 'next/server';
import { createEntitlementStore, verifyAdminRequest } from '@/lib/firebase/admin';
import { NO_STORE_HEADERS } from '@/lib/http';

export const runtime = 'nodejs';

/**
 * POST /api/admin/entitlements/revoke — revoke a manual/gift entitlement.
 *
 * Marks the existing manual grant as revoked (kept for audit) so the effective
 * entitlement falls back to the next strongest valid source — an active Paddle
 * subscription, or Free. No billing data is touched.
 *
 * Authorization: same as the grant route — a Firebase ID token on the
 * server-side `ADMIN_UIDS` allowlist. The body `uid` is the RECIPIENT.
 *
 * Body: { uid: string }
 */
export async function POST(request: Request) {
  const auth = await verifyAdminRequest(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status, headers: NO_STORE_HEADERS });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid-body' }, { status: 400, headers: NO_STORE_HEADERS });
  }
  if (typeof raw !== 'object' || raw === null) {
    return NextResponse.json({ error: 'invalid-body' }, { status: 400, headers: NO_STORE_HEADERS });
  }
  const uid = typeof (raw as Record<string, unknown>).uid === 'string'
    ? ((raw as Record<string, unknown>).uid as string).trim()
    : '';
  if (!uid) {
    return NextResponse.json({ error: 'invalid-uid' }, { status: 400, headers: NO_STORE_HEADERS });
  }

  const store = createEntitlementStore();
  const current = await store.getEntitlement(uid);
  if (!current?.manual || current.manual.revokedAt !== null) {
    return NextResponse.json({ error: 'no-manual-grant' }, { status: 404, headers: NO_STORE_HEADERS });
  }

  await store.putEntitlement(uid, {
    manual: {
      ...current.manual,
      revokedAt: Math.floor(Date.now() / 1000),
      revokedBy: auth.adminUid,
    },
  });

  return NextResponse.json({ ok: true, uid, revoked: true }, { headers: NO_STORE_HEADERS });
}
