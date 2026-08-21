import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  join(process.cwd(), 'src/components/onboarding/FirstSessionGuide.tsx'),
  'utf8',
);

describe('FirstSessionGuide UI contract', () => {
  it('is a labelled, keyboard-dismissible non-modal guide', () => {
    expect(source).toContain('role="dialog"');
    expect(source).toContain('aria-modal="false"');
    expect(source).toContain('aria-live="polite"');
    expect(source).toContain('aria-labelledby="first-session-guide-title"');
    expect(source).toContain("event.key === 'Escape'");
    expect(source).toContain('aria-label="Skip first-session guide"');
  });

  it('keeps touch targets usable and has a narrow-screen layout', () => {
    expect(source).toContain('inset-x-3');
    expect(source).toContain('sm:right-5');
    expect(source).toContain('min-h-11');
    expect(source).toContain('env(safe-area-inset-bottom)');
    expect(source).toContain('max-h-[calc(100dvh_');
  });

  it('teaches playback and review without repeating onboarding choices', () => {
    expect(source).toContain('Let the loop do the work');
    expect(source).toContain('Known');
    expect(source).toContain('Review Today');
    expect(source).not.toContain('Choose language');
    expect(source).not.toContain('Choose starting level');
    expect(source).not.toContain('Choose learning goal');
  });
});
