import { createHash } from 'node:crypto';
import { Timestamp } from 'firebase-admin/firestore';
import { NextResponse } from 'next/server';
import { consumeDistributedRateLimit, rateLimitClientKey } from '@/lib/distributedRateLimit';
import { validateClientErrorReport } from '@/lib/errorMonitoring/schema';
import { getAdminDb, isAdminConfigured, verifyIdToken } from '@/lib/firebase/admin';
import { NO_STORE_HEADERS } from '@/lib/http';
import { pruneExpiredDiagnostics } from '@/lib/errorMonitoring/retention';

export const runtime = 'nodejs';

const ERROR_COLLECTION = 'client_errors';
const MAX_BODY_CHARS = 2_048;
const WINDOW_MS = 10 * 60 * 1_000;
const RETENTION_MS = 30 * 24 * 60 * 60 * 1_000;

function sameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

function safeRelease(): string {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA?.trim() ?? '';
  return /^[0-9a-f]{7,40}$/i.test(sha) ? sha.slice(0, 12).toLowerCase() : 'local';
}

/**
 * POST /api/errors — privacy-safe, append-only production error ingestion.
 *
 * Guests are accepted because the app supports guest use, but every caller is
 * protected by a Firestore-backed distributed limit. A present bearer token
 * must verify; uid/IP are transient limiter inputs only and are never stored.
 */
export async function POST(request: Request) {
  if (!isAdminConfigured()) {
    return NextResponse.json(
      { error: 'monitoring-not-configured' },
      { status: 503, headers: NO_STORE_HEADERS },
    );
  }
  if (!sameOrigin(request)) {
    return NextResponse.json({ error: 'forbidden-origin' }, { status: 403, headers: NO_STORE_HEADERS });
  }

  const auth = request.headers.get('authorization');
  let uid: string | null = null;
  if (auth !== null) {
    const token = auth.startsWith('Bearer ') ? auth.slice('Bearer '.length).trim() : '';
    if (!token) {
      return NextResponse.json({ error: 'unauthenticated' }, { status: 401, headers: NO_STORE_HEADERS });
    }
    uid = await verifyIdToken(token);
    if (!uid) {
      return NextResponse.json({ error: 'unauthenticated' }, { status: 401, headers: NO_STORE_HEADERS });
    }
  }

  const contentLength = Number(request.headers.get('content-length') ?? '0');
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_CHARS) {
    return NextResponse.json({ error: 'payload-too-large' }, { status: 413, headers: NO_STORE_HEADERS });
  }

  let body: unknown;
  try {
    const raw = await request.text();
    if (raw.length > MAX_BODY_CHARS) {
      return NextResponse.json({ error: 'payload-too-large' }, { status: 413, headers: NO_STORE_HEADERS });
    }
    body = JSON.parse(raw) as unknown;
  } catch {
    return NextResponse.json({ error: 'invalid-body' }, { status: 400, headers: NO_STORE_HEADERS });
  }
  const report = validateClientErrorReport(body);
  if (!report) {
    return NextResponse.json({ error: 'invalid-report' }, { status: 400, headers: NO_STORE_HEADERS });
  }

  const transientKey = uid
    ? `client-errors:auth:${uid}`
    : `client-errors:guest:${rateLimitClientKey(request, 'unknown-client')}`;
  try {
    const rate = await consumeDistributedRateLimit({
      key: transientKey,
      limit: uid ? 30 : 8,
      windowMs: WINDOW_MS,
    });
    if (rate === 'limited') {
      return NextResponse.json({ error: 'rate-limited' }, { status: 429, headers: NO_STORE_HEADERS });
    }
  } catch {
    // Fail closed: a broken limiter must never become an unlimited write path.
    return NextResponse.json({ error: 'monitoring-unavailable' }, { status: 503, headers: NO_STORE_HEADERS });
  }

  const fingerprint = createHash('sha256')
    .update([report.source, report.area, report.errorName].join('|'))
    .digest('hex')
    .slice(0, 24);
  const now = Date.now();
  try {
    const db = getAdminDb();
    await db.collection(ERROR_COLLECTION).add({
      source: report.source,
      area: report.area,
      errorName: report.errorName,
      online: report.online,
      visibility: report.visibility,
      fingerprint,
      release: safeRelease(),
      createdAt: Timestamp.fromMillis(now),
      expiresAt: Timestamp.fromMillis(now + RETENTION_MS),
    });
    // TTL requires billing. Until it is enabled, prune a small expired batch
    // opportunistically without allowing housekeeping to reject a report.
    await pruneExpiredDiagnostics(db, ERROR_COLLECTION).catch(() => {});
  } catch {
    // Do not log the request/report or underlying exception: either may carry
    // infrastructure details. The bounded public error is enough for clients.
    return NextResponse.json({ error: 'store-failed' }, { status: 500, headers: NO_STORE_HEADERS });
  }

  return NextResponse.json({ ok: true }, { status: 202, headers: NO_STORE_HEADERS });
}
