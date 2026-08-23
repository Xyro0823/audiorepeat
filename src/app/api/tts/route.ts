import { NextResponse } from 'next/server';
import { consumeDistributedRateLimit } from '@/lib/distributedRateLimit';
import { createEntitlementStore, isAdminConfigured, verifyIdToken } from '@/lib/firebase/admin';
import { NO_STORE_HEADERS } from '@/lib/http';
import { planHasFeature } from '@/lib/plans';
import { computeEffectiveEntitlement } from '@/lib/stripe/entitlements';
import { isAzureTtsConfigured, synthesizeAzureSpeech } from '@/lib/tts/azureTts.server';

export const runtime = 'nodejs';
const LANG_RE = /^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/i;
const MAX_TEXT_LENGTH = 300;
const MAX_BODY_BYTES = 4096;

function bearerToken(request: Request): string | null {
  const auth = request.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  return auth.slice('Bearer '.length).trim() || null;
}

export async function GET() {
  return NextResponse.json(
    { configured: isAzureTtsConfigured(), provider: 'azure' },
    { headers: NO_STORE_HEADERS },
  );
}

export async function POST(request: Request) {
  if (!isAzureTtsConfigured()) {
    return NextResponse.json({ error: 'tts-not-configured' }, { status: 503, headers: NO_STORE_HEADERS });
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
  if (!uid) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401, headers: NO_STORE_HEADERS });
  }
  // Cloud voices + offline audio packs are Pro entitlements. The check reads
  // the server-side entitlement record (webhooks/admin grants write it) — a
  // client toggling local settings can never unlock synthesis. Fail closed:
  // no record / expired grant / canceled subscription → Free → rejected.
  const entitlement = await createEntitlementStore().getEntitlement(uid);
  const effective = computeEffectiveEntitlement(entitlement, Math.floor(Date.now() / 1000));
  if (!planHasFeature(effective.plan, 'offlineAudio')) {
    return NextResponse.json(
      { error: 'pro-required', feature: 'offlineAudio' },
      { status: 403, headers: NO_STORE_HEADERS },
    );
  }
  const rawBody = await request.text().catch(() => '');
  if (rawBody.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'body-too-large' }, { status: 413, headers: NO_STORE_HEADERS });
  }
  let body: { text?: unknown; lang?: unknown } | null = null;
  try {
    body = JSON.parse(rawBody) as { text?: unknown; lang?: unknown };
  } catch {
    body = null;
  }
  const text = typeof body?.text === 'string' ? body.text.trim() : '';
  const lang = typeof body?.lang === 'string' ? body.lang.trim() : '';
  if (!text || text.length > MAX_TEXT_LENGTH || !LANG_RE.test(lang)) {
    return NextResponse.json({ error: 'invalid-input' }, { status: 400, headers: NO_STORE_HEADERS });
  }
  if (
    await consumeDistributedRateLimit({ key: `tts:${uid}`, limit: 180, windowMs: 10 * 60_000 }) ===
    'limited'
  ) {
    return NextResponse.json(
      { error: 'rate-limited' },
      { status: 429, headers: { ...NO_STORE_HEADERS, 'Retry-After': '600' } },
    );
  }

  try {
    const result = await synthesizeAzureSpeech(text, lang);
    return new Response(result.audio, {
      headers: {
        ...NO_STORE_HEADERS,
        'Content-Type': 'audio/mpeg',
        'X-AudioRepeat-Voice': result.voice,
      },
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : '';
    const status = reason === 'azure-voice-unavailable' ? 422 : 502;
    return NextResponse.json(
      { error: status === 422 ? 'voice-unavailable' : 'tts-provider-unavailable' },
      { status, headers: NO_STORE_HEADERS },
    );
  }
}
