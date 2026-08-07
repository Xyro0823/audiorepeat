import type { AppSettings, VocabSet, VocabWord } from '@/types/app';

const FORMAT = 'audiorepeat-set';
const VERSION = 1;

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
 * Parse imported JSON. Accepts:
 *  - the app's own export format ({ format: 'audiorepeat-set', set })
 *  - a bare array of { target, translation[, repeats] } (lenient)
 * Returns a new set (fresh id) or null if invalid.
 */
export function parseSetJson(text: string): VocabSet | null {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }
  if (Array.isArray(data)) {
    // lenient: bare array of { target, translation, repeats? }
    return sanitizeSet({ name: 'Imported set', words: data });
  }
  const rawSet =
    data && typeof data === 'object' && 'set' in data ? (data as { set: unknown }).set : data;
  return sanitizeSet(rawSet);
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
      repeats: typeof w.repeats === 'number' && w.repeats >= 1 ? Math.round(w.repeats) : undefined,
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
  if (typeof s.targetGapMs === 'number' && s.targetGapMs >= 0 && s.targetGapMs <= 5000) out.targetGapMs = s.targetGapMs;
  if (typeof s.translationGapMs === 'number' && s.translationGapMs >= 0 && s.translationGapMs <= 5000) out.translationGapMs = s.translationGapMs;
  if (typeof s.loop === 'boolean') out.loop = s.loop;
  if (typeof s.cachedAudio === 'boolean') out.cachedAudio = s.cachedAudio;
  if (typeof s.targetVoiceURI === 'string') out.targetVoiceURI = s.targetVoiceURI;
  if (typeof s.translationVoiceURI === 'string') out.translationVoiceURI = s.translationVoiceURI;
  return Object.keys(out).length > 0 ? out : undefined;
}
