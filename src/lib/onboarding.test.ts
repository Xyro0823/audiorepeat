import { describe, expect, it } from 'vitest';
import {
  ONBOARDING_GOALS,
  ONBOARDING_LEVELS,
  onboardingLevelIds,
  onboardingPendingKey,
  onboardingRecordKey,
  isNewlyCreatedAccount,
  suggestedLevelFromQuiz,
  shouldShowOnboarding,
} from '@/lib/onboarding';
import { CEFR_LEVELS } from '@/types/app';

describe('shouldShowOnboarding', () => {
  it('shows only for a pending account with no completion record', () => {
    expect(shouldShowOnboarding(true, null)).toBe(true);
  });

  it('never shows for existing accounts (no pending marker)', () => {
    expect(shouldShowOnboarding(false, null)).toBe(false);
    expect(shouldShowOnboarding(false, { completed: true })).toBe(false);
    expect(shouldShowOnboarding(false, { lang: 'es' })).toBe(false);
  });

  it('suppresses after completion even if the pending marker lingers', () => {
    expect(shouldShowOnboarding(true, { completed: true, version: 1 })).toBe(false);
  });

  it('allows an in-progress partial record to resume', () => {
    expect(shouldShowOnboarding(true, { lang: 'mn' })).toBe(true);
    expect(shouldShowOnboarding(true, { lang: 'mn', level: 'A1' })).toBe(true);
  });
});

describe('isNewlyCreatedAccount', () => {
  const now = 1_700_000_000_000;

  it('treats a just-created account as new', () => {
    expect(isNewlyCreatedAccount(now, now + 5_000)).toBe(true);
    expect(isNewlyCreatedAccount(now, now + 60_000)).toBe(true);
  });

  it('does not treat an older account as new', () => {
    expect(isNewlyCreatedAccount(now, now + 60_001)).toBe(false);
    expect(isNewlyCreatedAccount(now, now + 3_600_000)).toBe(false);
  });

  it('rejects a timestamp in the future (clock skew)', () => {
    expect(isNewlyCreatedAccount(now + 5_000, now)).toBe(false);
  });
});

describe('onboarding data', () => {
  it('offers exactly the supported CEFR levels (no invented levels)', () => {
    expect(onboardingLevelIds()).toEqual(CEFR_LEVELS);
    for (const o of ONBOARDING_LEVELS) {
      expect(CEFR_LEVELS).toContain(o.level);
      expect(o.label.trim().length).toBeGreaterThan(0);
    }
  });

  it('offers a small, unique goal list', () => {
    const ids = ONBOARDING_GOALS.map((g) => g.id);
    expect(ids.length).toBe(6);
    expect(new Set(ids).size).toBe(ids.length);
    for (const g of ONBOARDING_GOALS) {
      expect(g.label.trim().length).toBeGreaterThan(0);
    }
  });

  it('scopes storage keys per account', () => {
    expect(onboardingPendingKey('uid-a')).not.toBe(onboardingPendingKey('uid-b'));
    expect(onboardingRecordKey('uid-a')).not.toBe(onboardingRecordKey('uid-b'));
    expect(onboardingRecordKey('uid-a')).toContain('uid-a');
    expect(onboardingPendingKey('uid-a')).toContain('uid-a');
  });
});

describe('early quiz calibration', () => {
  it('waits for enough real answers before suggesting a nearby level', () => {
    expect(suggestedLevelFromQuiz('A2', 11, 11)).toBeNull();
    expect(suggestedLevelFromQuiz('A2', 12, 11)).toBe('B1');
    expect(suggestedLevelFromQuiz('B1', 12, 4)).toBe('A2');
    expect(suggestedLevelFromQuiz('B1', 12, 8)).toBeNull();
  });

  it('never suggests a level beyond the supported CEFR bounds', () => {
    expect(suggestedLevelFromQuiz('A1', 12, 0)).toBeNull();
    expect(suggestedLevelFromQuiz('C2', 12, 12)).toBeNull();
  });
});
