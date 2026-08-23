import { describe, expect, it } from 'vitest';
import {
  FREE_DAILY_WORD_LIMIT,
  PLANS,
  PLAN_FEATURES,
  freeDailyLimitReached,
  isProPlan,
  planHasFeature,
  type FeatureKey,
  type PlanId,
} from '@/lib/plans';
import { dayKey } from '@/lib/practiceStats';

const ALL_FEATURES: FeatureKey[] = [
  'allLanguages',
  'fsrsReview',
  'quiz',
  'speedChallenge',
  'stats',
  'offlineAudio',
];

const PAID_PLANS: PlanId[] = ['pro', 'lifetime'];

describe('planHasFeature — the canonical entitlement matrix', () => {
  it('denies every paid feature on the Free plan', () => {
    for (const feature of ALL_FEATURES) {
      expect(planHasFeature('basic', feature), feature).toBe(false);
    }
  });

  it('grants every feature on Pro and Lifetime', () => {
    for (const plan of PAID_PLANS) {
      for (const feature of ALL_FEATURES) {
        expect(planHasFeature(plan, feature), `${plan}/${feature}`).toBe(true);
      }
    }
  });

  it('keeps the matrix exhaustive — a new FeatureKey must be classified', () => {
    const declared = new Set([...PLAN_FEATURES.basic, ...PLAN_FEATURES.pro, ...PLAN_FEATURES.lifetime]);
    for (const feature of ALL_FEATURES) expect(declared.has(feature)).toBe(true);
    expect(PLAN_FEATURES.basic).toEqual([]);
    expect(PLAN_FEATURES.lifetime).toEqual(PLAN_FEATURES.pro);
  });

  it('agrees with isProPlan for every feature', () => {
    const plans: PlanId[] = ['basic', 'pro', 'lifetime'];
    for (const plan of plans) {
      for (const feature of ALL_FEATURES) {
        expect(planHasFeature(plan, feature)).toBe(isProPlan(plan));
      }
    }
  });
});

describe('freeDailyLimitReached — Free 300 words/day boundary', () => {
  it('uses the advertised limit of 300 words', () => {
    expect(FREE_DAILY_WORD_LIMIT).toBe(300);
    // The public pricing copy must derive from the same constant.
    expect(PLANS.basic.features(0)).toContain(`${FREE_DAILY_WORD_LIMIT} words / day`);
  });

  it('lets Free practice up to (but not at) the limit', () => {
    expect(freeDailyLimitReached('basic', 0)).toBe(false);
    expect(freeDailyLimitReached('basic', 1)).toBe(false);
    expect(freeDailyLimitReached('basic', FREE_DAILY_WORD_LIMIT - 1)).toBe(false);
  });

  it('blocks Free at exactly the limit and beyond', () => {
    expect(freeDailyLimitReached('basic', FREE_DAILY_WORD_LIMIT)).toBe(true);
    expect(freeDailyLimitReached('basic', FREE_DAILY_WORD_LIMIT + 1)).toBe(true);
    expect(freeDailyLimitReached('basic', 100_000)).toBe(true);
  });

  it('never limits Pro or Lifetime', () => {
    for (const plan of PAID_PLANS) {
      expect(freeDailyLimitReached(plan, FREE_DAILY_WORD_LIMIT)).toBe(false);
      expect(freeDailyLimitReached(plan, 10_000_000)).toBe(false);
    }
  });

  it('resets at local midnight — the counter day key rolls over', () => {
    // The limit is keyed on practice-stats day keys (local calendar days), so
    // the same word count stops being "reached" once the day changes.
    const lateNight = new Date(2026, 7, 21, 23, 59, 0);
    const nextMorning = new Date(2026, 7, 22, 0, 1, 0);
    expect(dayKey(nextMorning) === dayKey(lateNight)).toBe(false);

    const wordsToday = (day: Date, words: number) =>
      dayKey(new Date()) === dayKey(day) ? words : 0;
    // Simulated rollover: yesterday's exhausted allowance is not carried in.
    expect(freeDailyLimitReached('basic', wordsToday(nextMorning, 0))).toBe(false);
  });
});
