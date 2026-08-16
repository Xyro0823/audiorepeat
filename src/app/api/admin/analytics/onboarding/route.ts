import { NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { getAdminDb, verifyAdminRequest } from '@/lib/firebase/admin';
import { summarizeOnboardingEvents } from '@/lib/analytics/summary';
import { NO_STORE_HEADERS } from '@/lib/http';

export const runtime = 'nodejs';

const ANALYTICS_COLLECTION = 'analytics_events';
const DEFAULT_DAYS = 90;
const MAX_DAYS = 365;
const DEFAULT_LIMIT = 5000;
const MAX_LIMIT = 10000;

function clampInt(raw: string | null, fallback: number, min: number, max: number): number {
  const n = Number.parseInt(raw ?? '', 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/**
 * GET /api/admin/analytics/onboarding?days=90&limit=5000
 *
 * Read-only aggregate onboarding summary for admins. Authorization is the
 * standard server-side flow: valid Firebase ID token whose uid is on the
 * `ADMIN_UIDS` allowlist (verifyAdminRequest) — never any client flag.
 *
 * Returns ONLY aggregate counts (started/completed/completion %, top
 * languages/levels/goals, recommendation-type split, completion-action split,
 * per-step funnel counts). No events are ever per-user; no uid/email is
 * exposed. The time window is bounded (default 90 days, max 365) and the doc
 * scan is capped (default 5000, max 10000) so the query stays cheap.
 */
export async function GET(request: Request) {
  const auth = await verifyAdminRequest(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status, headers: NO_STORE_HEADERS });
  }

  const url = new URL(request.url);
  const days = clampInt(url.searchParams.get('days'), DEFAULT_DAYS, 1, MAX_DAYS);
  const limit = clampInt(url.searchParams.get('limit'), DEFAULT_LIMIT, 1, MAX_LIMIT);
  const from = new Date(Date.now() - days * 86_400_000);

  let rawEvents: unknown[];
  try {
    const db = getAdminDb();
    const snap = await db
      .collection(ANALYTICS_COLLECTION)
      .where('ts', '>=', Timestamp.fromDate(from))
      .orderBy('ts', 'desc')
      .limit(limit)
      .get();
    rawEvents = snap.docs.map((d) => d.data());
  } catch (err) {
    console.error('[admin/analytics] query failed:', err);
    return NextResponse.json({ error: 'query-failed' }, { status: 500, headers: NO_STORE_HEADERS });
  }

  return NextResponse.json(
    { ok: true, windowDays: days, summary: summarizeOnboardingEvents(rawEvents, days) },
    { headers: NO_STORE_HEADERS },
  );
}
