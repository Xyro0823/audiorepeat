import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  join(process.cwd(), 'src/components/onboarding/FirstSessionGuide.tsx'),
  'utf8',
);
// The guide's copy lives in the i18n dictionaries; the component renders it
// through translated keys. Assert the contract against both.
const enDict = readFileSync(join(process.cwd(), 'src/lib/i18n/en/onboarding.ts'), 'utf8');

function dictValue(key: string): string {
  const match = enDict.match(new RegExp(`'${key}':\\s*'((?:[^'\\\\]|\\\\.)*)'`));
  expect(match, `missing dictionary key ${key}`).not.toBeNull();
  return match![1];
}

describe('FirstSessionGuide UI contract', () => {
  it('is a labelled, keyboard-dismissible non-modal guide', () => {
    expect(source).toContain('role="dialog"');
    expect(source).toContain('aria-modal="false"');
    expect(source).toContain('aria-live="polite"');
    expect(source).toContain('aria-labelledby="first-session-guide-title"');
    expect(source).toContain("event.key === 'Escape'");
    expect(source).toContain("t('onboarding.guide.skipAria')");
    expect(dictValue('onboarding.guide.skipAria')).toBe('Skip first-session guide');
  });

  it('keeps touch targets usable and has a narrow-screen layout', () => {
    expect(source).toContain('inset-x-3');
    expect(source).toContain('sm:right-5');
    expect(source).toContain('min-h-11');
    expect(source).toContain('env(safe-area-inset-bottom)');
    expect(source).toContain('max-h-[calc(100dvh_');
  });

  it('teaches playback and review without repeating onboarding choices', () => {
    expect(dictValue('onboarding.guide.step1.title')).toBe('Let the loop do the work');
    expect(dictValue('onboarding.guide.known')).toBe('Known');
    expect(dictValue('onboarding.guide.reviewToday')).toBe('Review Today');
    expect(source).not.toContain('Choose language');
    expect(source).not.toContain('Choose starting level');
    expect(source).not.toContain('Choose learning goal');
  });
});
