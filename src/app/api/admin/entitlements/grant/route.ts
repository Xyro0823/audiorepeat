import { NextResponse } from 'next/server';
import { createEntitlementStore, verifyAdminRequest } from '@/lib/firebase/admin';
import type { ManualEntitlement } from '@/lib/stripe/entitlements';

export const runtime = 'nodejs';

const MAX_REASON_LENGTH = 200;

type ParsedGrant =
  | { ok: true; uid: string; plan: 'pro' | 'lifetime'; expiresAt: number | null; reason: string | null }
  | { ok: false; error: string };

function parseGrantBody(body: unknown): ParsedGrant {
  if (typeof body !== 'object' || body === null) return { ok: false, error: 'invalid-body' };
  const b = body as Record<string, unknown>;

  const uid = typeof b.uid === 'string' ? b.uid.trim() : '';
  if (!uid) return { ok: false, error: 'invalid-uid' };

  const plan = b.plan;
  if (plan !== 'pro' && plan !== 'lifetime') return { ok: false, error: 'invalid-plan' };

  // expiresAt: optional unix seconds; null = never. An already-past expiry is
  // a malformed grant request.
  let expiresAt: number | null = null;
  if (b.expiresAt !== undefined && b.expiresAt !== null) {
    if (typeof b.expiresAt !== 'number' || !Number.isFinite(b.expiresAt)) {
      return { ok: false, error: 'invalid-expiry' };
    }
    if (b.expiresAt <= Math.floor(Date.now() / 1000)) {
      return { ok: false, error: 'invalid-expiry' };
    }
    expiresAt = Math.floor(b.expiresAt);
  }

  let reason: string | null = null;
  if (b.reason !== undefined && b.reason !== null) {
    if (typeof b.reason !== 'string') return { ok: false, error: 'invalid-reason' };
    reason = b.reason.trim();
    if (reason.length > MAX_REASON_LENGTH) return { ok: false, error: 'invalid-reason' };
    if (reason.length === 0) reason = null;
  }

  return { ok: true, uid, plan, expiresAt, reason };
}

/**
 * POST /api/admin/entitlements/grant — server-only manual/gift entitlement.
 *
 * Grants (or replaces) a manual Pro/Lifetime entitlement on `entitlements/{uid}`
 * WITHOUT touching billing: no Paddle customer, transaction, subscription, or
 * webhook is involved — this is an internal entitlement only.
 *
 * Authorization: the caller must present a Firebase ID token whose uid is on
 * the server-side `ADMIN_UIDS` allowlist (verified via firebase-admin). A
 * client-supplied "isAdmin" flag or spoofed body uid is never trusted — the
 * body `uid` is the RECIPIENT of the grant, and only an allowlisted admin may
 * call this at all.
 *
 * Body: { uid: string, plan: 'pro' | 'lifetime', expiresAt?: number | null,
 *         reason?: string | null }
 */
export async function POST(request: Request) {
  const auth = await verifyAdminRequest(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid-body' }, { status: 400 });
  }
  const parsed = parseGrantBody(raw);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const manual: ManualEntitlement = {
    plan: parsed.plan,
    reason: parsed.reason,
    expiresAt: parsed.expiresAt,
    grantedAt: Math.floor(Date.now() / 1000),
    grantedBy: auth.adminUid,
    revokedAt: null,
    revokedBy: null,
  };

  const store = createEntitlementStore();
  await store.putEntitlement(parsed.uid, { manual });

  return NextResponse.json({ ok: true, uid: parsed.uid, plan: parsed.plan });
}
