import type { DayMap, DayStat } from '@/lib/practiceStats';
import type { AppSettings, ReviewSchedule, VocabSet } from '@/types/app';

const FORMAT = 'audiorepeat-backup';
const VERSION = 1;

export interface BackupData {
  settings?: AppSettings;
  sets?: VocabSet[];
  days?: DayMap;
  username?: string;
}

/** Build the full user-data backup document (settings, sets, stats, name). */
export function buildBackup(data: BackupData): string {
  return JSON.stringify(
    {
      format: FORMAT,
      version: VERSION,
      exportedAt: new Date().toISOString(),
      ...data,
    },
    null,
    2,
  );
}

/** Trigger a browser download of the backup JSON. */
export function downloadBackup(text: string, filename: string): void {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function isObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object';
}

function sanitizeReview(raw: unknown): ReviewSchedule | undefined {
  if (!isObject(raw)) return undefined;
  const finite = (key: string) => typeof raw[key] === 'number' && Number.isFinite(raw[key]);
  if (
    !finite('due') ||
    !finite('stability') ||
    !finite('difficulty') ||
    !finite('elapsedDays') ||
    !finite('scheduledDays') ||
    !finite('learningSteps') ||
    !finite('reps') ||
    !finite('lapses') ||
    ![0, 1, 2, 3].includes(raw.state as number)
  ) {
    return undefined;
  }
  return {
    due: raw.due as number,
    stability: raw.stability as number,
    difficulty: raw.difficulty as number,
    elapsedDays: raw.elapsedDays as number,
    scheduledDays: raw.scheduledDays as number,
    learningSteps: raw.learningSteps as number,
    reps: raw.reps as number,
    lapses: raw.lapses as number,
    state: raw.state as ReviewSchedule['state'],
    lastReview: finite('lastReview') ? (raw.lastReview as number) : undefined,
  };
}

function sanitizeSets(raw: unknown): VocabSet[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: VocabSet[] = [];
  for (const s of raw) {
    if (!isObject(s) || typeof s.id !== 'string' || !Array.isArray(s.words)) continue;
    const words = s.words.filter(
      (w) =>
        isObject(w) &&
        typeof w.target === 'string' &&
        typeof w.translation === 'string' &&
        w.target.trim().length > 0 &&
        w.translation.trim().length > 0,
    ) as VocabSet['words'];
    if (words.length === 0) continue;
    out.push({
      id: s.id,
      name: typeof s.name === 'string' && s.name.trim() ? s.name.trim() : 'Restored set',
      lang: typeof s.lang === 'string' && s.lang ? s.lang : 'en-US',
      nativeLang: typeof s.nativeLang === 'string' && s.nativeLang ? s.nativeLang : 'en-US',
      words: words.map((w) => ({
        id: w.id,
        target: w.target.trim(),
        translation: w.translation.trim(),
        repeats:
          typeof w.repeats === 'number' && w.repeats >= 1 ? Math.round(w.repeats) : undefined,
        mastery: w.mastery === 'mastered' || w.mastery === 'hard' ? w.mastery : undefined,
        review: sanitizeReview(w.review),
        example: typeof w.example === 'string' && w.example.trim() ? w.example.trim() : undefined,
      })),
      settings: isObject(s.settings) ? (s.settings as Partial<AppSettings>) : undefined,
      cefr: typeof s.cefr === 'string' ? (s.cefr as VocabSet['cefr']) : undefined,
      createdAt: typeof s.createdAt === 'number' ? s.createdAt : Date.now(),
      updatedAt: typeof s.updatedAt === 'number' ? s.updatedAt : Date.now(),
    });
  }
  return out.length > 0 ? out : undefined;
}

function sanitizeSettings(raw: unknown): AppSettings | undefined {
  if (!isObject(raw)) return undefined;
  const s = raw as Record<string, unknown>;
  const out: Partial<AppSettings> = {};
  if (s.repeats === 1 || s.repeats === 2 || s.repeats === 3 || s.repeats === 5) out.repeats = s.repeats;
  if (typeof s.speed === 'number' && s.speed >= 0.5 && s.speed <= 2) out.speed = s.speed;
  if (typeof s.targetGapMs === 'number' && s.targetGapMs >= 1000 && s.targetGapMs <= 5000)
    out.targetGapMs = s.targetGapMs;
  if (typeof s.translationGapMs === 'number' && s.translationGapMs >= 0 && s.translationGapMs <= 5000)
    out.translationGapMs = s.translationGapMs;
  if (typeof s.loop === 'boolean') out.loop = s.loop;
  if (typeof s.cachedAudio === 'boolean') out.cachedAudio = s.cachedAudio;
  if (typeof s.cloudTts === 'boolean') out.cloudTts = s.cloudTts;
  if (typeof s.showHints === 'boolean') out.showHints = s.showHints;
  if (s.theme === 'neon' || s.theme === 'dark' || s.theme === 'light') out.theme = s.theme;
  if (typeof s.showExamples === 'boolean') out.showExamples = s.showExamples;
  if (typeof s.reminderEnabled === 'boolean') out.reminderEnabled = s.reminderEnabled;
  if (typeof s.reminderTime === 'string' && /^\d{2}:\d{2}$/.test(s.reminderTime))
    out.reminderTime = s.reminderTime;
  if (typeof s.targetVoiceURI === 'string') out.targetVoiceURI = s.targetVoiceURI;
  if (typeof s.translationVoiceURI === 'string') out.translationVoiceURI = s.translationVoiceURI;
  if (s.defaultNewSetLang === null || typeof s.defaultNewSetLang === 'string') {
    out.defaultNewSetLang = s.defaultNewSetLang;
  }
  return Object.keys(out).length > 0 ? (out as AppSettings) : undefined;
}

function sanitizeDays(raw: unknown): DayMap | undefined {
  if (!isObject(raw)) return undefined;
  const out: DayMap = {};
  for (const [key, val] of Object.entries(raw)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key) || !isObject(val)) continue;
    const w = typeof val.w === 'number' && val.w > 0 ? Math.floor(val.w) : 0;
    const ms = typeof val.ms === 'number' && val.ms > 0 ? Math.floor(val.ms) : 0;
    if (w <= 0 && ms <= 0) continue;
    // Preserve the per-language breakdown (powers the daily leaderboard).
    let langs: DayStat['langs'];
    if (isObject(val.langs)) {
      const clean: DayStat['langs'] = {};
      for (const [lang, l] of Object.entries(val.langs)) {
        if (!isObject(l)) continue;
        const lw = typeof l.w === 'number' && l.w > 0 ? Math.floor(l.w) : 0;
        const lms = typeof l.ms === 'number' && l.ms > 0 ? Math.floor(l.ms) : 0;
        if (lw > 0 || lms > 0) clean[lang] = { w: lw, ms: lms };
      }
      if (Object.keys(clean).length > 0) langs = clean;
    }
    out[key] = langs ? { w, ms, langs } : { w, ms };
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/**
 * Parse and validate an Evoq backup. Returns the safe slices of the
 * document (settings, sets, stats days, username), or null if it isn't one.
 */
export function parseBackup(text: string): BackupData | null {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isObject(data) || data.format !== FORMAT) return null;
  // Read days from data.days (current format) with fallback to data.stats
  // (legacy format) for backward compatibility.
  const rawDays = data.days ?? data.stats;
  return {
    settings: sanitizeSettings(data.settings),
    sets: sanitizeSets(data.sets),
    days: sanitizeDays(rawDays),
    username:
      typeof data.username === 'string' && data.username.trim()
        ? data.username.trim().slice(0, 24)
        : undefined,
  };
}
