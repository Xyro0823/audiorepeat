import { NextResponse } from 'next/server';
import { consumeDistributedRateLimit } from '@/lib/distributedRateLimit';
import { isAdminConfigured, verifyIdToken } from '@/lib/firebase/admin';
import { NO_STORE_HEADERS } from '@/lib/http';
import {
  isAzureTranslatorConfigured,
  MAX_TRANSLATE_CHARS,
  MAX_TRANSLATE_ITEMS,
  translateToMongolian,
} from '@/lib/translator/azureTranslator.server';

export const runtime = 'nodejs';
const MAX_BODY_BYTES = 16_000;
const DAILY_CHAR_LIMIT = 25_000;
const DAILY_WINDOW_MS = 24 * 60 * 60_000;
const BURST_LIMIT = 20;
const BURST_WINDOW_MS = 60_000;

function bearerToken(request: Request): string | null {
  const auth = request.headers.get('authorization');
  return auth?.startsWith('Bearer ') ? auth.slice(7).trim() || null : null;
}

export async function GET() {
  return NextResponse.json(
    { configured: isAzureTranslatorConfigured(), provider: 'azure' },
    { headers: NO_STORE_HEADERS },
  );
}

export async function POST(request: Request) {
  if (!isAzureTranslatorConfigured()) {
    return NextResponse.json({ error: 'translator-not-configured' }, { status: 503, headers: NO_STORE_HEADERS });
  }
  if (!isAdminConfigured()) {
    return NextResponse.json({ error: 'auth-server-not-configured' }, { status: 503, headers: NO_STORE_HEADERS });
  }
  const contentLength = Number(request.headers.get('content-length') ?? '0');
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'body-too-large' }, { status: 413, headers: NO_STORE_HEADERS });
  }
  const token = bearerToken(request);
  const uid = token ? await verifyIdToken(token) : null;
  if (!uid) return NextResponse.json({ error: 'unauthenticated' }, { status: 401, headers: NO_STORE_HEADERS });

  const raw = await request.text().catch(() => '');
  if (raw.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'body-too-large' }, { status: 413, headers: NO_STORE_HEADERS });
  }
  let body: { items?: unknown } | null = null;
  try { body = JSON.parse(raw) as { items?: unknown }; } catch { body = null; }
  const items = Array.isArray(body?.items) ? body.items : [];
  const texts = items.map((item) => (
    item && typeof item === 'object' && typeof (item as { text?: unknown }).text === 'string'
      ? (item as { text: string }).text.trim()
      : ''
  ));
  const chars = texts.reduce((total, text) => total + text.length, 0);
  if (
    items.length === 0 || items.length > MAX_TRANSLATE_ITEMS ||
    texts.some((text) => !text || text.length > 500) || chars > MAX_TRANSLATE_CHARS
  ) return NextResponse.json({ error: 'invalid-input' }, { status: 400, headers: NO_STORE_HEADERS });

  if (await consumeDistributedRateLimit({ key: `translate-burst:${uid}`, limit: BURST_LIMIT, windowMs: BURST_WINDOW_MS }) === 'limited') {
    return NextResponse.json({ error: 'rate-limited', scope: 'burst' }, { status: 429, headers: NO_STORE_HEADERS });
  }
  // Limit in characters through fixed-size claims. It intentionally errs on
  // the protective side; saved translations never consume this again.
  const claims = Math.max(1, Math.ceil(chars / 100));
  for (let claim = 0; claim < claims; claim += 1) {
    if (await consumeDistributedRateLimit({ key: `translate-day:${uid}`, limit: Math.floor(DAILY_CHAR_LIMIT / 100), windowMs: DAILY_WINDOW_MS }) === 'limited') {
      return NextResponse.json({ error: 'rate-limited', scope: 'daily' }, { status: 429, headers: NO_STORE_HEADERS });
    }
  }
  try {
    const translations = await translateToMongolian(texts);
    return NextResponse.json({ translations }, { headers: NO_STORE_HEADERS });
  } catch {
    return NextResponse.json({ error: 'translator-unavailable' }, { status: 502, headers: NO_STORE_HEADERS });
  }
}
