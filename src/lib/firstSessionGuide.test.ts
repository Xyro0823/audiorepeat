import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  FIRST_SESSION_GUIDE_STEP_COUNT,
  dismissFirstSessionGuide,
  firstSessionGuideKey,
  getFirstSessionGuideSnapshot,
  normalizeFirstSessionGuideStep,
  parseFirstSessionGuideRecord,
  saveFirstSessionGuideStep,
  shouldShowFirstSessionGuide,
} from './firstSessionGuide';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('first-session guide helpers', () => {
  it('scopes guide state to the active account', () => {
    expect(firstSessionGuideKey('user-a')).toContain('user-a');
    expect(firstSessionGuideKey('user-a')).not.toBe(firstSessionGuideKey('user-b'));
  });

  it('shows only after onboarding, inside the first player session', () => {
    const ready = {
      pathname: '/player',
      onboardingPending: false,
      onboardingCompleted: true,
      dismissed: false,
    };

    expect(shouldShowFirstSessionGuide(ready)).toBe(true);
    expect(shouldShowFirstSessionGuide({ ...ready, pathname: '/dashboard' })).toBe(false);
    expect(shouldShowFirstSessionGuide({ ...ready, onboardingPending: true })).toBe(false);
    expect(shouldShowFirstSessionGuide({ ...ready, onboardingCompleted: false })).toBe(false);
    expect(shouldShowFirstSessionGuide({ ...ready, dismissed: true })).toBe(false);
  });

  it('sanitizes persisted progress and corrupted records', () => {
    expect(normalizeFirstSessionGuideStep(-10)).toBe(0);
    expect(normalizeFirstSessionGuideStep(99)).toBe(FIRST_SESSION_GUIDE_STEP_COUNT - 1);
    expect(normalizeFirstSessionGuideStep(1.9)).toBe(1);
    expect(parseFirstSessionGuideRecord('{bad json')).toMatchObject({ step: 0, dismissed: false });
    expect(parseFirstSessionGuideRecord('{"version":1,"step":2,"dismissed":true}')).toEqual({
      version: 1,
      step: 2,
      dismissed: true,
    });
  });

  it('persists progress and dismissal independently for each account', () => {
    const records = new Map<string, string>();
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (key: string) => records.get(key) ?? null,
        setItem: (key: string, value: string) => records.set(key, value),
      },
    });

    saveFirstSessionGuideStep('user-a', 1);
    saveFirstSessionGuideStep('user-b', 2);
    dismissFirstSessionGuide('user-a');

    expect(parseFirstSessionGuideRecord(getFirstSessionGuideSnapshot('user-a'))).toMatchObject({
      step: 1,
      dismissed: true,
    });
    expect(parseFirstSessionGuideRecord(getFirstSessionGuideSnapshot('user-b'))).toMatchObject({
      step: 2,
      dismissed: false,
    });
  });
});
