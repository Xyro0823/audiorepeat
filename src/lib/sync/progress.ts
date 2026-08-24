import type { DayMap } from '@/lib/practiceStats';

/**
 * Learning-progress sync — an extension of the existing Cloud Sync system
 * (same /api/sync endpoint, same Firestore user scope, same verified-token
 * identity). Progress is STALE-SAFE and STATE-BASED: every sync pushes the
 * full local snapshot and receives the merged server truth back, so retries
 * are idempotent and offline edits survive until the next successful sync.
 *
 * Merge semantics per field (pure, commutative, idempotent):
 *  - day counters (w/ms, per-language) → per-counter MAX across devices.
 *    Never double counts a retried push; undercounts (never overcounts) the
 *    rare same-day multi-device case, which keeps the Free daily word cap
 *    honest.
 *  - best scores → MAX per set.
 *  - streaks are DERIVED from the merged day map (no stored streak to merge).
 *  - resetAt clears history deterministically: days at or before it are
 *    dropped during merge so a stats reset cannot resurrect remotely.
 */

export const MAX_PROGRESS_DAYS = 730;
export const MAX_BEST_SCORES = 400;
export const MAX_LANGS_PER_DAY = 8;
export const MAX_WORDS_PER_DAY = 20_000;
export const MAX_MS_PER_DAY = 86_400_000;
export const MAX_SCORE = 100_000;

const DAY_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;
const LANG_KEY_RE = /^[a-zA-Z]{2,3}(?:-[a-zA-Z0-9]{2,8})*$/;
const SET_ID_RE = /^[A-Za-z0-9._:-]{1,160}$/;

export interface ProgressBestScores {
  [setId: string]: number;
}

export interface ProgressPayload {
  /** Full local per-day practice history (already pruned). */
  days: DayMap;
  /** Full local personal-best map for speed challenges. */
  bestScores: ProgressBestScores;
  /** Local timestamp of the last deliberate stats reset (0 = never). */
  resetAt: number;
  /**
   * Replace instead of merge — used by backup restore and "clear stats" so
   * the server adopts the local view wholesale instead of max-merging with
   * remote history that is being intentionally overwritten.
   */
  replace: boolean;
}

export interface MergedProgress {
  days: DayMap;
  bestScores: ProgressBestScores;
  resetAt: number;
}

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** Cap a sanitized day counter pair into safe bounds; null when unusable. */
function sanitizeDayStat(
  value: unknown,
): { w: number; ms: number; langs?: Record<string, { w: number; ms: number }> } | null {
  if (!value || typeof value === 'object') {
    const day = value as { w?: unknown; ms?: unknown; langs?: unknown };
    if (!finite(day.w) || !finite(day.ms)) return null;
    if (day.w < 0 || day.ms < 0 || day.w > MAX_WORDS_PER_DAY || day.ms > MAX_MS_PER_DAY) return null;
    let langs: Record<string, { w: number; ms: number }> | undefined;
    if (day.langs && typeof day.langs === 'object') {
      const entries = Object.entries(day.langs as Record<string, unknown>);
      if (entries.length > MAX_LANGS_PER_DAY) return null;
      for (const [lang, stat] of entries) {
        if (!LANG_KEY_RE.test(lang) || !stat || typeof stat !== 'object') return null;
        const s = stat as { w?: unknown; ms?: unknown };
        if (!finite(s.w) || !finite(s.ms) || s.w < 0 || s.ms < 0) return null;
        if (s.w > MAX_WORDS_PER_DAY || s.ms > MAX_MS_PER_DAY) return null;
        langs = langs ?? {};
        langs[lang] = { w: s.w, ms: s.ms };
      }
    }
    return { w: day.w, ms: day.ms, ...(langs ? { langs } : {}) };
  }
  return null;
}

/** Validate + bound a full progress payload from any client. */
export function sanitizeProgressPayload(value: unknown): ProgressPayload | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as {
    days?: unknown;
    bestScores?: unknown;
    resetAt?: unknown;
    replace?: unknown;
  };
  if (!raw.days || typeof raw.days !== 'object') return null;
  const dayEntries = Object.entries(raw.days as Record<string, unknown>);
  if (dayEntries.length > MAX_PROGRESS_DAYS) return null;
  const days: DayMap = {};
  for (const [key, stat] of dayEntries) {
    if (!DAY_KEY_RE.test(key)) return null;
    // Reject impossible calendar dates (e.g. 2026-02-31 fails Date round-trip).
    if (Number.isNaN(Date.parse(`${key}T00:00:00Z`))) return null;
    const clean = sanitizeDayStat(stat);
    if (!clean) return null;
    days[key] = clean;
  }
  if (!raw.bestScores || typeof raw.bestScores !== 'object') return null;
  const scoreEntries = Object.entries(raw.bestScores as Record<string, unknown>);
  if (scoreEntries.length > MAX_BEST_SCORES) return null;
  const bestScores: ProgressBestScores = {};
  for (const [setId, score] of scoreEntries) {
    if (!SET_ID_RE.test(setId)) return null;
    if (!finite(score) || !Number.isInteger(score) || score < 0 || score > MAX_SCORE) return null;
    bestScores[setId] = score;
  }
  const resetAt = raw.resetAt === undefined ? 0 : raw.resetAt;
  if (!finite(resetAt) || resetAt < 0) return null;
  return {
    days,
    bestScores,
    resetAt,
    replace: raw.replace === true,
  };
}

export function sanitizeMergedProgress(value: unknown): MergedProgress | null {
  const payload = sanitizeProgressPayload(value);
  if (!payload) return null;
  return { days: payload.days, bestScores: payload.bestScores, resetAt: payload.resetAt };
}

/** Drop days older than the retention window / a stats reset marker. */
export function pruneDays(days: DayMap, now: number, resetAt: number): DayMap {
  const cutoff = new Date(now - MAX_PROGRESS_DAYS * 86_400_000);
  const cutoffKey = cutoff.toISOString().slice(0, 10);
  const out: DayMap = {};
  for (const [key, stat] of Object.entries(days)) {
    if (key < cutoffKey) continue;
    if (resetAt > 0 && Date.parse(`${key}T23:59:59Z`) <= resetAt) continue;
    out[key] = stat;
  }
  return out;
}

/**
 * Merge remote merged-truth into the local view (client side) or incoming
 * local state into stored truth (server side). Symmetric by construction:
 * both sides run this with (current, incoming) in either role.
 */
export function mergeProgress(
  current: MergedProgress,
  incoming: MergedProgress,
  now: number,
): MergedProgress {
  const resetAt = Math.max(current.resetAt, incoming.resetAt);
  const days: DayMap = { ...pruneDays(current.days, now, resetAt) };
  for (const [key, incomingDay] of Object.entries(incoming.days)) {
    // A stats reset clears history deterministically — days at or before the
    // reset marker are dropped from BOTH sides during every merge.
    if (resetAt > 0 && Date.parse(`${key}T23:59:59Z`) <= resetAt) continue;
    const existing = days[key];
    if (!existing) {
      days[key] = incomingDay;
      continue;
    }
    const langs =
      existing.langs || incomingDay.langs
        ? (() => {
            const merged: Record<string, { w: number; ms: number }> = {};
            for (const [lang, s] of Object.entries(existing.langs ?? {})) {
              merged[lang] = { ...s };
            }
            for (const [lang, s] of Object.entries(incomingDay.langs ?? {})) {
              const prev = merged[lang];
              merged[lang] = prev
                ? { w: Math.max(prev.w, s.w), ms: Math.max(prev.ms, s.ms) }
                : { ...s };
            }
            return Object.keys(merged).length > 0 ? merged : undefined;
          })()
        : undefined;
    days[key] = {
      w: Math.max(existing.w, incomingDay.w),
      ms: Math.max(existing.ms, incomingDay.ms),
      ...(langs ? { langs } : {}),
    };
  }
  const bestScores: ProgressBestScores = { ...current.bestScores };
  for (const [setId, score] of Object.entries(incoming.bestScores)) {
    bestScores[setId] = Math.max(bestScores[setId] ?? 0, score);
  }
  return {
    days: pruneDays(days, now, resetAt),
    bestScores,
    resetAt,
  };
}

/** Replace semantics for backup restore / clear-stats flows. */
export function replaceWithProgress(incoming: MergedProgress, now: number): MergedProgress {
  return {
    days: pruneDays(incoming.days, now, incoming.resetAt),
    bestScores: incoming.bestScores,
    resetAt: incoming.resetAt,
  };
}
