export const AUDIO_CACHE_NAME = 'tts-audio';
const AUDIO_PREFIX = '/audio/';

/** Stable, deterministic hash — no crypto dependency needed. */
function fnv1a(str: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

export function audioCacheKey(text: string, lang: string, voiceURI?: string): string {
  // Speed is deliberately excluded: playback rate is applied per-playback via
  // audio.playbackRate, so a single generated blob serves every speed setting
  // (and pre-warming doesn't have to generate one blob per rate).
  return fnv1a([lang, voiceURI ?? 'default', text].join('|'));
}

export function audioCacheUrl(key: string): string {
  return `${AUDIO_PREFIX}${key}.mp3`;
}

export async function getCachedAudioBlob(key: string): Promise<Blob | null> {
  if (typeof caches === 'undefined') return null;
  try {
    const cache = await caches.open(AUDIO_CACHE_NAME);
    const res = await cache.match(audioCacheUrl(key));
    if (!res || !res.ok) return null;
    return await res.blob();
  } catch {
    return null;
  }
}

export async function putCachedAudioBlob(key: string, blob: Blob): Promise<void> {
  if (typeof caches === 'undefined') return;
  try {
    const cache = await caches.open(AUDIO_CACHE_NAME);
    await cache.put(
      audioCacheUrl(key),
      new Response(blob, {
        headers: { 'Content-Type': blob.type || 'audio/mpeg' },
      }),
    );
  } catch {
    // quota exceeded or cache API unavailable — non-fatal
  }
}
