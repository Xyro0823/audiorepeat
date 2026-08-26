import { describe, expect, it } from 'vitest';
import { cloudTtsAccessFor, isMongolianLocale } from '@/lib/tts/cloudAccess';

describe('cloudTtsAccessFor', () => {
  it('allows a Free account to generate only Mongolian speech', () => {
    expect(cloudTtsAccessFor('basic', 'mn-MN')).toBe('free-mongolian');
    expect(cloudTtsAccessFor('basic', 'MN')).toBe('free-mongolian');
    expect(cloudTtsAccessFor('basic', 'zh-CN')).toBeNull();
  });

  it('retains full cloud access for paid plans', () => {
    expect(cloudTtsAccessFor('pro', 'zh-CN')).toBe('pro');
    expect(cloudTtsAccessFor('lifetime', 'en-US')).toBe('pro');
  });

  it('recognizes only the mn language subtag as Mongolian', () => {
    expect(isMongolianLocale('mn-MN')).toBe(true);
    expect(isMongolianLocale('mn')).toBe(true);
    expect(isMongolianLocale('en-MN')).toBe(false);
  });
});
