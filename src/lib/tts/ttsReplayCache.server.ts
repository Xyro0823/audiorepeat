import 'server-only';
import { createHash } from 'node:crypto';

/**
 * Instance-local micro-cache for identical TTS requests (same user, language,
 * text). Absorbs accidental replay storms — client retry loops after a flaky
 * response, duplicate prewarm/playback jobs racing on the same word — without
 * re-paying Azure synthesis. Best-effort only: serverless instances are
 * ephemeral and this cache is not shared across them, so hard abuse bounds
 * come from the distributed rate limits in /api/tts; this just makes replays
 * free instead of merely capped.
 */

const TTL_MS = 10 * 60_000;
const MAX_ENTRIES = 300;

interface Entry {
  audio: ArrayBuffer;
  voice: string;
  expiresAt: number;
}

const cache = new Map<string, Entry>();

/** Content-addressed key: uid + language + exact text. */
export function ttsReplayKey(uid: string, lang: string, text: string): string {
  return createHash('sha256').update(`${uid}\n${lang}\n${text}`).digest('hex');
}

export function getCachedTtsAudio(
  key: string,
  now = Date.now(),
): { audio: ArrayBuffer; voice: string } | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (now >= entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return { audio: entry.audio, voice: entry.voice };
}

export function storeTtsAudio(
  key: string,
  audio: ArrayBuffer,
  voice: string,
  now = Date.now(),
): void {
  // Re-insert to refresh Map insertion order so a hot key is evicted last.
  cache.delete(key);
  cache.set(key, { audio, voice, expiresAt: now + TTL_MS });
  while (cache.size > MAX_ENTRIES) {
    const oldest = cache.keys().next();
    if (oldest.done) break;
    cache.delete(oldest.value);
  }
}

export function resetTtsReplayCacheForTests(): void {
  cache.clear();
}
