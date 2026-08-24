import { describe, expect, it } from 'vitest';
import type { DayMap } from '@/lib/practiceStats';
import {
  MAX_BEST_SCORES,
  MAX_PROGRESS_DAYS,
  mergeProgress,
  pruneDays,
  replaceWithProgress,
  sanitizeMergedProgress,
  sanitizeProgressPayload,
  type MergedProgress,
} from './progress';

function day(w: number, ms = w * 1000): { w: number; ms: number } {
  return { w, ms };
}

function view(
  days: DayMap,
  bestScores: Record<string, number> = {},
  resetAt = 0,
): MergedProgress {
  return { days, bestScores, resetAt };
}

const NOW = Date.parse('2026-08-20T12:00:00Z');

describe('progress merge semantics', () => {
  it('unions days from two devices without losing either side', () => {
    const deviceA = view({ '2026-08-19': day(10) });
    const deviceB = view({ '2026-08-18': day(30) });
    const merged = mergeProgress(deviceA, deviceB, NOW);
    expect(Object.keys(merged.days).sort()).toEqual(['2026-08-18', '2026-08-19']);
    // Streaks derive from the union → both days count, no double counting.
    expect(merged.days['2026-08-19'].w).toBe(10);
    expect(merged.days['2026-08-18'].w).toBe(30);
  });

  it('same-day multi-device activity merges per-counter max — no double counting', () => {
    const deviceA = view({ '2026-08-19': { w: 120, ms: 600_000 } });
    const deviceB = view({ '2026-08-19': { w: 80, ms: 900_000 } });
    const merged = mergeProgress(deviceA, deviceB, NOW);
    // Max per counter: never inflates (Free cap stays honest), never loses a
    // whole day; slight same-device-class undercount is the safe direction.
    expect(merged.days['2026-08-19']).toMatchObject({ w: 120, ms: 900_000 });
  });

  it('is idempotent — retrying the same push changes nothing', () => {
    const server = view({ '2026-08-19': day(50) }, { 'set-1': 12 });
    const client = view({ '2026-08-19': day(20), '2026-08-18': day(5) }, { 'set-1': 9 });
    const once = mergeProgress(server, client, NOW);
    const twice = mergeProgress(once, client, NOW);
    expect(twice).toEqual(once);
  });

  it('merges best scores as max in both directions', () => {
    const a = view({}, { 'set-1': 30, 'set-2': 5 });
    const b = view({}, { 'set-1': 25, 'set-3': 40 });
    expect(mergeProgress(a, b, NOW).bestScores).toEqual({
      'set-1': 30,
      'set-2': 5,
      'set-3': 40,
    });
    expect(mergeProgress(b, a, NOW).bestScores).toEqual({
      'set-1': 30,
      'set-2': 5,
      'set-3': 40,
    });
  });

  it('keeps per-language breakdowns under max-merge', () => {
    const a = view({
      '2026-08-19': {
        w: 10,
        ms: 1000,
        langs: { 'es-ES': { w: 8, ms: 800 }, fr: { w: 2, ms: 200 } },
      },
    });
    const b = view({
      '2026-08-19': {
        w: 12,
        ms: 1500,
        langs: { 'es-ES': { w: 4, ms: 4000 }, de: { w: 3, ms: 300 } },
      },
    });
    const merged = mergeProgress(a, b, NOW);
    expect(merged.days['2026-08-19'].langs).toEqual({
      'es-ES': { w: 8, ms: 4000 },
      fr: { w: 2, ms: 200 },
      de: { w: 3, ms: 300 },
    });
  });

  it('a stats reset drops days at/before the marker on both sides', () => {
    const resetAt = Date.parse('2026-08-15T00:00:00Z');
    const server = view({ '2026-08-10': day(9), '2026-08-16': day(7) }, {}, resetAt);
    const client = view({ '2026-08-14': day(3) });
    const merged = mergeProgress(server, client, NOW);
    expect(merged.days['2026-08-10']).toBeUndefined();
    expect(merged.days['2026-08-14']).toBeUndefined(); // ≤ reset marker
    expect(merged.days['2026-08-16']).toBeDefined();
    expect(merged.resetAt).toBe(resetAt);
  });

  it('prunes history beyond the retention window', () => {
    const old = new Date(NOW - (MAX_PROGRESS_DAYS + 5) * 86_400_000).toISOString().slice(0, 10);
    const recent = new Date(NOW - 86_400_000).toISOString().slice(0, 10);
    const pruned = pruneDays({ [old]: day(1), [recent]: day(2) }, NOW, 0);
    expect(pruned[old]).toBeUndefined();
    expect(pruned[recent]).toBeDefined();
  });

  it('replace semantics adopt the incoming view wholesale (backup restore)', () => {
    const restored = view({ '2026-08-02': day(3) }, {});
    const result = replaceWithProgress(restored, NOW);
    expect(result.days).toEqual({ '2026-08-02': day(3) });
    expect(result.bestScores).toEqual({});
  });
});

describe('progress payload sanitization', () => {
  it('accepts a well-formed payload', () => {
    const payload = sanitizeProgressPayload({
      days: { '2026-08-19': { w: 5, ms: 2500, langs: { es: { w: 5, ms: 2500 } } } },
      bestScores: { 'seed-es': 42 },
      resetAt: 0,
      replace: false,
    });
    expect(payload).not.toBeNull();
    expect(payload!.days['2026-08-19']?.w).toBe(5);
  });

  it('rejects malformed days, keys, scores and caps', () => {
    expect(sanitizeProgressPayload(null)).toBeNull();
    expect(sanitizeProgressPayload({})).toBeNull();
    expect(sanitizeProgressPayload({ days: 'x', bestScores: {} })).toBeNull();
    expect(sanitizeProgressPayload({ days: { '19-08-2026': day(1) }, bestScores: {} })).toBeNull();
    expect(sanitizeProgressPayload({ days: { '2026-13-99': day(1) }, bestScores: {} })).toBeNull();
    expect(sanitizeProgressPayload({ days: { '2026-08-19': { w: -1, ms: 0 } }, bestScores: {} })).toBeNull();
    expect(
      sanitizeProgressPayload({ days: { '2026-08-19': { w: 1_000_000, ms: 0 } }, bestScores: {} }),
    ).toBeNull();
    expect(
      sanitizeProgressPayload({ days: { '2026-08-19': day(1) }, bestScores: { 'bad id!': 5 } }),
    ).toBeNull();
    expect(
      sanitizeProgressPayload({ days: { '2026-08-19': day(1) }, bestScores: { set: 1.5 } }),
    ).toBeNull();
    expect(
      sanitizeProgressPayload({ days: { '2026-08-19': day(1) }, bestScores: { set: 500_000 } }),
    ).toBeNull();
    // Quota caps.
    const tooManyDays: DayMap = {};
    for (let i = 0; i < MAX_PROGRESS_DAYS + 1; i += 1) {
      const d = new Date(NOW - i * 86_400_000).toISOString().slice(0, 10);
      tooManyDays[d] = day(1);
    }
    expect(sanitizeProgressPayload({ days: tooManyDays, bestScores: {} })).toBeNull();
    const tooManyScores: Record<string, number> = {};
    for (let i = 0; i < MAX_BEST_SCORES + 1; i += 1) tooManyScores[`set-${i}`] = 1;
    expect(sanitizeProgressPayload({ days: {}, bestScores: tooManyScores })).toBeNull();
  });

  it('round-trips merged documents through the response sanitizer', () => {
    const merged = view({ '2026-08-19': day(4) }, { s: 3 }, 5);
    expect(sanitizeMergedProgress({ ...merged, syncedAt: 123 })).toEqual(merged);
  });
});
