import { NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { getAdminDb, isAdminConfigured, verifyIdToken } from '@/lib/firebase/admin';
import { validateOnboardingEvent } from '@/lib/analytics/events';
import { analyticsRateLimiter } from '@/lib/analytics/rateLimit';
import { NO_STORE_HEADERS } from '@/lib/http';

export const runtime = 'nodejs';

const ANALYTICS_COLLECTION = 'analytics_events';

/**
 * POST /api/analytics/onboarding — privacy-conscious onboarding telemetry.
 *
 * Security/privacy contract:
 *   - The caller MUST present a valid Firebase ID token (Bearer). The uid is
 *     verified server-side and then DISCARDED — it is never stored. This
 *     rejects anonymous spam while keeping events aggregate and non-identifying.
 *   - The payload is validated against the shared, fixed schema
 *     (validateOnboardingEvent): unknown event names, unknown property keys,
 *     missing/extra keys, and invalid values (including anything PII-shaped)
 *     are rejected with 400 and never stored.
 *   - Storage is append-only: one Firestore doc per event with
 *     { event, properties, ts }. No uid, no IP, no cookies, no identifiers.
 *   - Failures are silent from the client's perspective (fire-and-forget);
 *     this endpoint never blocks onboarding or navigation.
 *
 * Rate limiting: a bounded in-memory fixed-window limiter (60 validated
 * events / 10 min / uid, see lib/analytics/rateLimit.ts) rejects over-limit
 * requests with 429 + no-store. The uid is used ONLY as the transient
 * enforcement key — it is never stored. The limiter is best-effort per server
 * instance/isolate (serverless scale-out multiplies the cap), which is fine
 * for aggregate product telemetry. No IP is read or stored; no cookies.
 */
export async function POST(request: Request) {
  if (!isAdminConfigured()) {
    return NextResponse.json(
      { error: 'auth-server-not-configured' },
      { status: 503, headers: NO_STORE_HEADERS },
    );
  }

  const auth = request.headers.get('authorization');
  const token = auth?.startsWith('Bearer ') ? auth.slice('Bearer '.length).trim() : null;
  if (!token) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401, headers: NO_STORE_HEADERS });
  }
  // Verified and discarded: the caller's identity is not part of the event.
  const uid = await verifyIdToken(token);
  if (!uid) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401, headers: NO_STORE_HEADERS });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid-body' }, { status: 400, headers: NO_STORE_HEADERS });
  }

  const event = validateOnboardingEvent(body);
  if (!event) {
    return NextResponse.json({ error: 'invalid-event' }, { status: 400, headers: NO_STORE_HEADERS });
  }

  // Rate limit ONLY validated events (the ones that would be stored): malformed
  // payloads already cannot write or distort aggregates, so they stay 400 and
  // do not consume quota. Over-limit valid requests → 429, nothing stored.
  if (analyticsRateLimiter.consume(uid) === 'limited') {
    return NextResponse.json({ error: 'rate-limited' }, { status: 429, headers: NO_STORE_HEADERS });
  }

  try {
    await getAdminDb()
      .collection(ANALYTICS_COLLECTION)
      .add({ event: event.event, properties: event.properties, ts: Timestamp.now() });
  } catch (err) {
    console.error('[analytics/onboarding] store failed:', err);
    return NextResponse.json({ error: 'store-failed' }, { status: 500, headers: NO_STORE_HEADERS });
  }

  return NextResponse.json({ ok: true }, { headers: NO_STORE_HEADERS });
}
