import { NextResponse } from 'next/server';
import { consumeDistributedRateLimit } from '@/lib/distributedRateLimit';
import { createEntitlementStore, isAdminConfigured, verifyIdToken } from '@/lib/firebase/admin';
import { NO_STORE_HEADERS } from '@/lib/http';
import { computeEffectiveEntitlement } from '@/lib/stripe/entitlements';
import { isAzureTtsConfigured, synthesizeAzureSpeech } from '@/lib/tts/azureTts.server';
import { cloudTtsAccessFor, FREE_MONGOLIAN_TTS_DAILY_LIMIT } from '@/lib/tts/cloudAccess';
import {
  getCachedTtsAudio,
  storeTtsAudio,
  ttsReplayKey,
} from '@/lib/tts/ttsReplayCache.server';

export const runtime = 'nodejs';
const LANG_RE = /^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/i;
const MAX_TEXT_LENGTH = 300;
const MAX_BODY_BYTES = 4096;

/**
 * Cost/abuse tiers for the paid synthesis provider (both via the shared
 * Firestore fixed-window limiter):
 *  - burst: 150 / 60s per uid. Legit load never approaches this — prewarm
 *    runs ≤6 parallel workers (~2 req/s) and playback is one word at a time —
 *    while a script hammering the endpoint is stopped within seconds.
 *  - daily: 1000 / 24h per uid. Far above heavy real use (audio caches on the
 *    device after first synthesis; realistic engaged usage is a few hundred),
 *    yet caps worst-case Azure spend at ~1000 × 300 chars / user / day.
 */
const TTS_BURST_LIMIT = 150;
const TTS_BURST_WINDOW_MS = 60_000;
const TTS_DAILY_LIMIT = 1000;
const TTS_DAILY_WINDOW_MS = 24 * 60 * 60_000;

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
  // The entitlement is read only on the server. Paid accounts retain full
  // Azure speech; Free accounts may synthesize only Mongolian explanations.
  const entitlement = await createEntitlementStore().getEntitlement(uid);
  const effective = computeEffectiveEntitlement(entitlement, Math.floor(Date.now() / 1000));
  const access = cloudTtsAccessFor(effective.plan, lang);
  if (!access) {
    return NextResponse.json(
      { error: 'pro-required', feature: 'offlineAudio' },
      { status: 403, headers: NO_STORE_HEADERS },
    );
  }
  // Identical requests within a short window are served from the instance-local
  // replay cache: retries and duplicate jobs must not re-pay Azure (or burn
  // rate-limit budget) for byte-identical audio. Entitlement was already
  // verified above, so a cache hit never leaks audio to a non-entitled caller.
  const replayKey = ttsReplayKey(uid, lang, text);
  const cached = getCachedTtsAudio(replayKey);
  if (cached) {
    return new Response(cached.audio, {
      headers: {
        ...NO_STORE_HEADERS,
        'Content-Type': 'audio/mpeg',
        'X-AudioRepeat-Voice': cached.voice,
      },
    });
  }
  if (
    await consumeDistributedRateLimit({
      key: `tts-burst:${access}:${uid}`,
      limit: TTS_BURST_LIMIT,
      windowMs: TTS_BURST_WINDOW_MS,
    }) ===
    'limited'
  ) {
    return NextResponse.json(
      { error: 'rate-limited', scope: 'burst' },
      { status: 429, headers: { ...NO_STORE_HEADERS, 'Retry-After': String(TTS_BURST_WINDOW_MS / 1000) } },
    );
  }
  if (
    await consumeDistributedRateLimit({
      key: `tts-day:${access}:${uid}`,
      limit: access === 'free' ? FREE_MONGOLIAN_TTS_DAILY_LIMIT : TTS_DAILY_LIMIT,
      windowMs: TTS_DAILY_WINDOW_MS,
    }) ===
    'limited'
  ) {
    return NextResponse.json(
      { error: 'rate-limited', scope: 'daily' },
      { status: 429, headers: { ...NO_STORE_HEADERS, 'Retry-After': String(TTS_DAILY_WINDOW_MS / 1000) } },
    );
  }

  try {
    const result = await synthesizeAzureSpeech(text, lang);
    storeTtsAudio(replayKey, result.audio, result.voice);
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
