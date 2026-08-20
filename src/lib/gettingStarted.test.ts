import { describe, expect, it } from 'vitest';
import { gettingStartedDismissKey, gettingStartedProgress } from './gettingStarted';

describe('getting started helpers', () => {
  it('scopes dismissal to the active account', () => {
    expect(gettingStartedDismissKey('user-1')).toContain('user-1');
    expect(gettingStartedDismissKey('user-1')).not.toBe(gettingStartedDismissKey('user-2'));
    expect(gettingStartedDismissKey()).toContain('guest');
  });

  it('counts completed activation steps', () => {
    expect(gettingStartedProgress({ languageReady: true, setReady: true, practiceReady: false, installed: false })).toBe(2);
    expect(gettingStartedProgress({ languageReady: true, setReady: true, practiceReady: true, installed: true })).toBe(4);
  });
});

