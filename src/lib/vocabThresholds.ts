/**
 * Shared thresholds and helpers for vocabulary/topic health checks.
 *
 * Single source of truth: both `src/lib/languageAudit.test.ts` (CI-gated
 * guards) and `scripts/vocab-health.mjs` (developer report) read from here so
 * the report can never drift from the enforced limits.
 */

/** Max exact-target overlap between two levels of the same language. */
export const CROSS_LEVEL_TARGET_MAX = 0.5;
/** Max exact [target, English] pair overlap between two levels of the same language. */
export const CROSS_LEVEL_PAIR_MAX = 0.5;
/** Max same-level target overlap between two different languages. */
export const LANGUAGE_ISOLATION_MAX = 0.7;
/** Max B1 vs A1+A2 exact-target overlap (fraction of the B1 pack). */
export const B1_OVERLAP_MAX = 0.1;

/** Lowercase + trim a word for comparison. */
export function norm(s: string): string {
  return s.trim().toLowerCase();
}

/** |A ∩ B| / min(|A|, |B|) for two sets. */
export function overlapRatio(a: ReadonlySet<string>, b: ReadonlySet<string>): number {
  const denom = Math.min(a.size, b.size);
  if (denom === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / denom;
}

/** Target strings of a word list. */
export function targetSet(words: ReadonlyArray<readonly [string, string]>): Set<string> {
  return new Set(words.map(([t]) => norm(t)));
}

/** Exact [target, English] pairs of a word list. */
export function pairSet(words: ReadonlyArray<readonly [string, string]>): Set<string> {
  return new Set(words.map(([t, e]) => `${norm(t)}|${norm(e)}`));
}
