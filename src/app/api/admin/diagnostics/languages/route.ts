import { NextResponse } from 'next/server';
import { verifyAdminRequest } from '@/lib/firebase/admin';
import { NO_STORE_HEADERS } from '@/lib/http';
import { analyze, loadRepo } from '@/lib/vocabHealth';

export const runtime = 'nodejs';

/**
 * GET /api/admin/diagnostics/languages — admin-only language/vocabulary
 * health report.
 *
 * Authorization is checked server-side against the `ADMIN_UIDS` allowlist
 * (never any client-supplied flag), exactly like the other admin APIs. The
 * response is the same analysis the developer `vocab:health` CLI produces
 * (shared logic in `src/lib/vocabHealth.ts`), served as JSON only:
 * summary counts, per-language pack stats, per-topic core/parity, per-row
 * MATCH/VARIANT/TOPIC-ONLY bank coverage, variant rows for human review and
 * any hard terminology errors.
 *
 * Security:
 *  - 401 unauthenticated / 403 not on allowlist / 503 admin not configured.
 *  - Cache-Control: no-store on every response (never cached by browser, SW,
 *    CDN or intermediaries; the SW additionally treats /api/admin/* as
 *    network-only).
 *  - Read-only: never mutates data. The payload contains language/vocabulary
 *    data only — never ADMIN_UIDS, Firebase service-account material, user
 *    records, auth tokens, Paddle credentials or any bypass secret.
 */
export async function GET(request: Request) {
  const auth = await verifyAdminRequest(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status, headers: NO_STORE_HEADERS });
  }

  let report;
  try {
    report = analyze(loadRepo());
  } catch (err) {
    console.error('[admin/diagnostics] failed to load vocabulary data:', err);
    return NextResponse.json({ error: 'diagnostics-unavailable' }, { status: 500, headers: NO_STORE_HEADERS });
  }

  return NextResponse.json(report, { headers: NO_STORE_HEADERS });
}
