import type { AppSettings, VocabSet } from '@/types/app';
import { parseSetJson } from './io';

const VERSION = 1;

type ShareWord = [string, string] | [string, string, { r?: number }];

interface SharePayload {
  v: number;
  n: string;
  l: string;
  x: string;
  c?: VocabSet['cefr'];
  s?: VocabSet['settings'];
  w: ShareWord[];
}

/**
 * Encode a set into a compact, URL-safe string for `/#set=<encoded>` links.
 * Words are packed as [target, translation, opts?] arrays and ids are dropped
 * entirely — the recipient's import always mints fresh ids anyway.
 */
export function encodeSetForUrl(set: VocabSet): string {
  const payload: SharePayload = {
    v: VERSION,
    n: set.name,
    l: set.lang,
    x: set.nativeLang,
    w: set.words.map((word) => {
      const opts =
        word.repeats !== undefined
          ? {
              ...(word.repeats !== undefined ? { r: word.repeats } : {}),
            }
          : undefined;
      return (opts ? [word.target, word.translation, opts] : [word.target, word.translation]) as ShareWord;
    }),
  };
  if (set.cefr) payload.c = set.cefr;
  const safeSettings = shareableSettings(set.settings);
  if (safeSettings) payload.s = safeSettings;
  return toBase64Url(JSON.stringify(payload));
}

function shareableSettings(settings: Partial<AppSettings> | undefined): Partial<AppSettings> | undefined {
  if (!settings) return undefined;
  const safe: Partial<AppSettings> = {};
  if (settings.repeats !== undefined) safe.repeats = settings.repeats;
  if (settings.speed !== undefined) safe.speed = settings.speed;
  if (settings.targetGapMs !== undefined) safe.targetGapMs = settings.targetGapMs;
  if (settings.translationGapMs !== undefined) safe.translationGapMs = settings.translationGapMs;
  if (settings.loop !== undefined) safe.loop = settings.loop;
  return Object.keys(safe).length > 0 ? safe : undefined;
}

/** Decode a `/?set=` value back into a fresh VocabSet, or null if invalid. */
export function decodeSetFromUrl(encoded: string): VocabSet | null {
  try {
    const text = fromBase64Url(encoded.trim());
    const data = JSON.parse(text) as Partial<SharePayload>;
    if (data.v !== VERSION || typeof data.n !== 'string' || !Array.isArray(data.w)) return null;
    const full = {
      name: data.n,
      lang: data.l,
      nativeLang: data.x,
      cefr: data.c,
      settings: data.s,
      words: data.w.map((entry) => {
        const [target, translation, opts] = entry;
        return {
          target,
          translation,
          ...(opts?.r !== undefined ? { repeats: opts.r } : {}),
          // Mastery and FSRS history are deliberately ignored, including in old links.
        };
      }),
    };
    // Reuse the battle-tested import sanitizer: fresh ids, validations, defaults.
    return parseSetJson(JSON.stringify(full));
  } catch {
    return null;
  }
}

/** Build the shareable URL for a set (absolute, fragment payload stays client-side). */
export function shareUrlForSet(set: VocabSet): string {
  const base =
    typeof window !== 'undefined' ? window.location.origin : 'https://audiorepeat.app';
  // Fragment payloads never reach the web server or its request logs.
  return `${base}/dashboard#set=${encodeSetForUrl(set)}`;
}

// ---------- unicode-safe base64url ----------

function toBase64Url(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(b64: string): string {
  const bin = atob(b64.replace(/-/g, '+').replace(/_/g, '/'));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}
