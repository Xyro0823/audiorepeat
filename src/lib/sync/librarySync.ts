import type { SetTombstone } from '@/lib/db/indexedDb';
import type { AppSettings, ReviewSchedule, VocabSet, VocabWord } from '@/types/app';

export const MAX_SYNC_SETS = 200;
export const MAX_SYNC_RECORDS = 400;
export const MAX_WORDS_PER_SET = 5_000;
export const MAX_TOTAL_SYNC_WORDS = 80_000;
export const MAX_SYNC_BODY_BYTES = 5_000_000;
export const MAX_SYNC_SET_BYTES = 800_000;

const ID_RE = /^[A-Za-z0-9._:-]{1,160}$/;

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const clean = value.trim();
  return clean && clean.length <= max ? clean : null;
}

function sanitizeReview(value: unknown): ReviewSchedule | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const review = value as Partial<ReviewSchedule>;
  if (
    !finite(review.due) ||
    !finite(review.stability) ||
    !finite(review.difficulty) ||
    !finite(review.elapsedDays) ||
    !finite(review.scheduledDays) ||
    !finite(review.learningSteps) ||
    !finite(review.reps) ||
    !finite(review.lapses) ||
    ![0, 1, 2, 3].includes(review.state as number)
  ) return undefined;
  return {
    due: review.due,
    stability: review.stability,
    difficulty: review.difficulty,
    elapsedDays: review.elapsedDays,
    scheduledDays: review.scheduledDays,
    learningSteps: review.learningSteps,
    reps: review.reps,
    lapses: review.lapses,
    state: review.state as ReviewSchedule['state'],
    ...(finite(review.lastReview) ? { lastReview: review.lastReview } : {}),
  };
}

function sanitizeWord(value: unknown): VocabWord | null {
  if (!value || typeof value !== 'object') return null;
  const word = value as Partial<VocabWord>;
  const id = cleanText(word.id, 160);
  const target = cleanText(word.target, 500);
  const translation = cleanText(word.translation, 500);
  if (!id || !ID_RE.test(id) || !target || !translation) return null;
  return {
    id,
    target,
    translation,
    ...(finite(word.repeats) && word.repeats >= 1 && word.repeats <= 20
      ? { repeats: Math.round(word.repeats) }
      : {}),
    ...(word.mastery === 'mastered' || word.mastery === 'hard' ? { mastery: word.mastery } : {}),
    ...(sanitizeReview(word.review) ? { review: sanitizeReview(word.review) } : {}),
    ...(cleanText(word.example, 1_000) ? { example: cleanText(word.example, 1_000)! } : {}),
  };
}

function sanitizeSetSettings(value: unknown): Partial<AppSettings> | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const input = value as Partial<AppSettings>;
  const safe: Partial<AppSettings> = {};
  if ([1, 2, 3, 5].includes(input.repeats as number)) safe.repeats = input.repeats;
  if (finite(input.speed) && input.speed >= 0.5 && input.speed <= 2) safe.speed = input.speed;
  if (finite(input.targetGapMs) && input.targetGapMs >= 1_000 && input.targetGapMs <= 5_000) {
    safe.targetGapMs = input.targetGapMs;
  }
  if (
    finite(input.translationGapMs) &&
    input.translationGapMs >= 0 &&
    input.translationGapMs <= 5_000
  ) safe.translationGapMs = input.translationGapMs;
  for (const key of ['loop', 'cachedAudio', 'cloudTts', 'showHints', 'showExamples'] as const) {
    if (typeof input[key] === 'boolean') safe[key] = input[key];
  }
  if (typeof input.targetVoiceURI === 'string' && input.targetVoiceURI.length <= 300) {
    safe.targetVoiceURI = input.targetVoiceURI;
  }
  if (typeof input.translationVoiceURI === 'string' && input.translationVoiceURI.length <= 300) {
    safe.translationVoiceURI = input.translationVoiceURI;
  }
  return Object.keys(safe).length > 0 ? safe : undefined;
}

export function sanitizeSyncSet(value: unknown): VocabSet | null {
  if (!value || typeof value !== 'object') return null;
  const set = value as Partial<VocabSet>;
  const id = cleanText(set.id, 160);
  const name = cleanText(set.name, 160);
  const lang = cleanText(set.lang, 48);
  const nativeLang = cleanText(set.nativeLang, 48);
  if (!id || !ID_RE.test(id) || !name || !lang || !nativeLang || !Array.isArray(set.words)) return null;
  if (set.words.length === 0 || set.words.length > MAX_WORDS_PER_SET) return null;
  const words = set.words.map(sanitizeWord);
  if (words.some((word) => word === null)) return null;
  if (!finite(set.createdAt) || !finite(set.updatedAt)) return null;
  const sanitized: VocabSet = {
    id,
    name,
    lang,
    nativeLang,
    words: words as VocabWord[],
    ...(set.cefr && ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].includes(set.cefr)
      ? { cefr: set.cefr }
      : {}),
    ...(sanitizeSetSettings(set.settings) ? { settings: sanitizeSetSettings(set.settings) } : {}),
    createdAt: set.createdAt,
    updatedAt: set.updatedAt,
  };
  if (new TextEncoder().encode(JSON.stringify(sanitized)).byteLength > MAX_SYNC_SET_BYTES) return null;
  return sanitized;
}

export function sanitizeTombstone(value: unknown): SetTombstone | null {
  if (!value || typeof value !== 'object') return null;
  const entry = value as Partial<SetTombstone>;
  return typeof entry.id === 'string' && ID_RE.test(entry.id) && finite(entry.deletedAt)
    ? { id: entry.id, deletedAt: entry.deletedAt }
    : null;
}

export interface LibrarySyncPayload {
  sets: VocabSet[];
  tombstones: SetTombstone[];
  since: number;
}

export function sanitizeSyncPayload(value: unknown): LibrarySyncPayload | null {
  if (!value || typeof value !== 'object') return null;
  const payload = value as { sets?: unknown; tombstones?: unknown; since?: unknown };
  if (!Array.isArray(payload.sets) || !Array.isArray(payload.tombstones)) return null;
  if (payload.sets.length > MAX_SYNC_SETS || payload.tombstones.length > MAX_SYNC_SETS) return null;
  const sets = payload.sets.map(sanitizeSyncSet);
  const tombstones = payload.tombstones.map(sanitizeTombstone);
  if (sets.some((set) => set === null) || tombstones.some((entry) => entry === null)) return null;
  if ((sets as VocabSet[]).reduce((sum, set) => sum + set.words.length, 0) > MAX_TOTAL_SYNC_WORDS) return null;
  const ids = [...(sets as VocabSet[]).map((set) => set.id), ...(tombstones as SetTombstone[]).map((entry) => entry.id)];
  if (new Set(ids).size !== ids.length) return null;
  const since = payload.since === undefined ? 0 : payload.since;
  if (!finite(since) || since < 0) return null;
  return { sets: sets as VocabSet[], tombstones: tombstones as SetTombstone[], since };
}

export function newerLibraryRecord(
  current: { updatedAt?: number; deletedAt?: number } | undefined,
  incoming: { updatedAt?: number; deletedAt?: number },
): boolean {
  const currentAt = current?.deletedAt ?? current?.updatedAt ?? 0;
  const incomingAt = incoming.deletedAt ?? incoming.updatedAt ?? 0;
  return !current || incomingAt > currentAt;
}

export interface LibraryQuotaCounts {
  activeCount: number;
  wordCount: number;
  recordCount: number;
}

export function transitionLibraryQuota(
  counts: LibraryQuotaCounts,
  current: { kind?: string; wordCount?: number } | undefined,
  incoming: { kind: 'set'; wordCount: number } | { kind: 'deleted' },
): LibraryQuotaCounts {
  const wasActive = current?.kind === 'set';
  const willBeActive = incoming.kind === 'set';
  return {
    activeCount: counts.activeCount + Number(willBeActive) - Number(wasActive),
    wordCount:
      counts.wordCount +
      (willBeActive ? incoming.wordCount : 0) -
      (wasActive ? current.wordCount ?? 0 : 0),
    recordCount: counts.recordCount + (current ? 0 : 1),
  };
}
