import { CEFR_LEVELS } from '@/types/app';
import type { AppSettings, VocabSet, VocabWord } from '@/types/app';
import {
  importBytesExceed,
  importWordCountExceeds,
  MAX_IMPORT_WORDS,
} from './importLimits';

const FORMAT = 'audiorepeat-set';
const VERSION = 1;

export type ParseSetError = 'invalid' | 'too-large' | 'too-many-words';
export interface ParseSetTooManyWords {
  ok: false;
  error: 'too-many-words';
  /** The canonical cap (MAX_IMPORT_WORDS) for friendly messaging. */
  limit: number;
}
export type ParseSetResult =
  | { ok: true; set: VocabSet }
  | { ok: false; error: Exclude<ParseSetError, 'too-many-words'> }
  | ParseSetTooManyWords;

export function exportSetJson(set: VocabSet): string {
  return JSON.stringify({ format: FORMAT, version: VERSION, set }, null, 2);
}

/** Trigger a browser download of the set as a JSON file. */
export function downloadSet(set: VocabSet): void {
  const blob = new Blob([exportSetJson(set)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${set.name.trim().replace(/[^\w\- ]+/g, '').replace(/\s+/g, '-').toLowerCase() || 'set'}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Parse imported JSON with explicit size-rejection reasons. Accepts:
 *  - the app's own export format ({ format: 'audiorepeat-set', set })
 *  - a bare array of { target, translation[, repeats] } (lenient)
 *
 * Oversized input is rejected BEFORE parsing (byte cap) or immediately after
 * sanitizing (word cap) — an oversized set is never partially imported.
 */
export function parseSetJsonChecked(text: string): ParseSetResult {
  // Byte-accurate pre-parse rejection: never JSON.parse unbounded input.
  if (importBytesExceed(text)) return { ok: false, error: 'too-large' };

  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: 'invalid' };
  }
  if (Array.isArray(data)) {
    // lenient: bare array of { target, translation, repeats? }
    const set = sanitizeSet({ name: 'Imported set', words: data });
    return set ? { ok: true, set } : { ok: false, error: 'invalid' };
  }
  const rawSet =
    data && typeof data === 'object' && 'set' in data ? (data as { set: unknown }).set : data;
  const set = sanitizeSet(rawSet);
  if (!set) return { ok: false, error: 'invalid' };
  // Word-cap guard: a single import can never exceed the per-set limit, so
  // oversized data is rejected whole instead of silently breaking sync later.
  if (importWordCountExceeds(set.words.length)) {
    return { ok: false, error: 'too-many-words', limit: MAX_IMPORT_WORDS } as const;
  }
  return { ok: true, set };
}

/** Back-compatible wrapper — callers that only need a set-or-null. */
export function parseSetJson(text: string): VocabSet | null {
  const result = parseSetJsonChecked(text);
  return result.ok ? result.set : null;
}

function sanitizeSet(raw: unknown): VocabSet | null {
  const s = (raw ?? {}) as Partial<VocabSet>;
  if (typeof s.name !== 'string' || !Array.isArray(s.words)) return null;

  const seenIds = new Set<string>();
  const words: VocabWord[] = s.words
    .filter(
      (w) =>
        !!w &&
        typeof w.target === 'string' &&
        typeof w.translation === 'string' &&
        w.target.trim().length > 0 &&
        w.translation.trim().length > 0,
    )
    .map((w) => {
      let id = typeof w.id === 'string' && w.id ? w.id : crypto.randomUUID();
      while (seenIds.has(id)) id = crypto.randomUUID();
      seenIds.add(id);
      return {
        id,
        target: w.target.trim(),
        translation: w.translation.trim(),
        translationMn:
          typeof w.translationMn === 'string' && w.translationMn.trim().length > 0
            ? w.translationMn.trim().slice(0, 500)
            : undefined,
        repeats: typeof w.repeats === 'number' && w.repeats >= 1 ? Math.round(w.repeats) : undefined,
        mastery: w.mastery === 'mastered' || w.mastery === 'hard' ? w.mastery : undefined,
      };
    });

  if (words.length === 0) return null;

  return {
    id: crypto.randomUUID(),
    name: s.name.trim() || 'Imported set',
    lang: typeof s.lang === 'string' && s.lang ? s.lang : 'en-US',
    nativeLang: typeof s.nativeLang === 'string' && s.nativeLang ? s.nativeLang : 'en-US',
    words,
    settings: sanitizeSettings(s.settings),
    cefr:
      typeof s.cefr === 'string' && (CEFR_LEVELS as readonly string[]).includes(s.cefr)
        ? (s.cefr as (typeof CEFR_LEVELS)[number])
        : undefined,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

function sanitizeSettings(raw: unknown): Partial<AppSettings> | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const s = raw as Record<string, unknown>;
  const out: Partial<AppSettings> = {};
  if (s.repeats === 1 || s.repeats === 2 || s.repeats === 3 || s.repeats === 5) out.repeats = s.repeats;
  if (typeof s.speed === 'number' && s.speed >= 0.5 && s.speed <= 2) out.speed = s.speed;
  // targetGapMs is intentionally 1-5s only (matches the player slider); legacy
  // sub-1s values are dropped on import rather than silently played back.
  if (typeof s.targetGapMs === 'number' && s.targetGapMs >= 1000 && s.targetGapMs <= 5000) out.targetGapMs = s.targetGapMs;
  if (typeof s.translationGapMs === 'number' && s.translationGapMs >= 0 && s.translationGapMs <= 5000) out.translationGapMs = s.translationGapMs;
  if (typeof s.loop === 'boolean') out.loop = s.loop;
  if (typeof s.cachedAudio === 'boolean') out.cachedAudio = s.cachedAudio;
  if (typeof s.cloudTts === 'boolean') out.cloudTts = s.cloudTts;
  if (typeof s.targetVoiceURI === 'string') out.targetVoiceURI = s.targetVoiceURI;
  if (typeof s.translationVoiceURI === 'string') out.translationVoiceURI = s.translationVoiceURI;
  return Object.keys(out).length > 0 ? out : undefined;
}
