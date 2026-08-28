import { Timestamp } from 'firebase-admin/firestore';
import { NextResponse } from 'next/server';
import { consumeDistributedRateLimit } from '@/lib/distributedRateLimit';
import { getAdminDb, isAdminConfigured, verifyIdToken } from '@/lib/firebase/admin';
import { NO_STORE_HEADERS } from '@/lib/http';

export const runtime = 'nodejs';

const MAX_BODY_BYTES = 2_048;
const REPORT_LIMIT = 12;
const WINDOW_MS = 24 * 60 * 60 * 1_000;

function sameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  try { return new URL(origin).origin === new URL(request.url).origin; } catch { return false; }
}

function text(value: unknown, max: number): string | null {
  return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= max ? value.trim() : null;
}

/** Authenticated, rate-limited suggestion queue for Mongolian glossary fixes. */
export async function POST(request: Request) {
  if (!isAdminConfigured()) return NextResponse.json({ error: 'not-configured' }, { status: 503, headers: NO_STORE_HEADERS });
  if (!sameOrigin(request)) return NextResponse.json({ error: 'forbidden-origin' }, { status: 403, headers: NO_STORE_HEADERS });
  const auth = request.headers.get('authorization');
  const token = auth?.startsWith('Bearer ') ? auth.slice(7).trim() : null;
  const uid = token ? await verifyIdToken(token) : null;
  if (!uid) return NextResponse.json({ error: 'unauthenticated' }, { status: 401, headers: NO_STORE_HEADERS });
  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) return NextResponse.json({ error: 'payload-too-large' }, { status: 413, headers: NO_STORE_HEADERS });
  let body: unknown;
  try { body = JSON.parse(raw); } catch { return NextResponse.json({ error: 'invalid-input' }, { status: 400, headers: NO_STORE_HEADERS }); }
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return NextResponse.json({ error: 'invalid-input' }, { status: 400, headers: NO_STORE_HEADERS });
  const data = body as Record<string, unknown>;
  const language = text(data.language, 12);
  const target = text(data.target, 240);
  const currentTranslation = text(data.currentTranslation, 240);
  const suggestion = text(data.suggestion, 240);
  if (!language || !/^[a-z]{2,3}(?:-[A-Z]{2})?$/i.test(language) || !target || !currentTranslation || !suggestion) {
    return NextResponse.json({ error: 'invalid-input' }, { status: 400, headers: NO_STORE_HEADERS });
  }
  const limited = await consumeDistributedRateLimit({ key: `translation-reports:${uid}`, limit: REPORT_LIMIT, windowMs: WINDOW_MS }).catch(() => 'limited' as const);
  if (limited === 'limited') return NextResponse.json({ error: 'rate-limited' }, { status: 429, headers: NO_STORE_HEADERS });
  const now = Date.now();
  try {
    await getAdminDb().collection('translation_reports').add({ language: language.toLowerCase(), target, currentTranslation, suggestion, status: 'open', createdAt: Timestamp.fromMillis(now) });
  } catch {
    return NextResponse.json({ error: 'store-failed' }, { status: 500, headers: NO_STORE_HEADERS });
  }
  return NextResponse.json({ ok: true }, { status: 202, headers: NO_STORE_HEADERS });
}
