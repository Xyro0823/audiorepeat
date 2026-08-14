import { NextResponse } from 'next/server';
import { verifyAdminRequest } from '@/lib/firebase/admin';
import { NO_STORE_HEADERS } from '@/lib/http';

export const runtime = 'nodejs';

/**
 * GET /api/admin/status — does the caller have admin rights?
 *
 * Authorization is checked server-side against the `ADMIN_UIDS` allowlist
 * (never any client-supplied flag):
 *   200 { ok: true, admin: true }   — allowlisted admin
 *   401 unauthenticated             — missing/invalid token
 *   403 forbidden                   — valid token, not on the allowlist
 *   503 auth-server-not-configured  — admin layer not configured
 */
export async function GET(request: Request) {
  const auth = await verifyAdminRequest(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status, headers: NO_STORE_HEADERS });
  }
  return NextResponse.json({ ok: true, admin: true }, { headers: NO_STORE_HEADERS });
}
