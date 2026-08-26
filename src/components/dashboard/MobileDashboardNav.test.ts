import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(join(process.cwd(), 'src/components/dashboard/MobileDashboardNav.tsx'), 'utf8');
const library = readFileSync(join(process.cwd(), 'src/components/library/SetLibrary.tsx'), 'utf8');

describe('MobileDashboardNav', () => {
  it('keeps thumb navigation phone-only and reserves a distinct primary resume action', () => {
    expect(source).toContain('md:hidden');
    expect(source).toContain("scrollTo('review-today')");
    expect(source).toContain("scrollTo('vocab-grid')");
    expect(source).toContain('btn-primary -mt-4 flex h-16');
  });

  it('keeps bottom navigation clear of dashboard content and desktop utility controls', () => {
    expect(library).toContain('pb-28 pt-3 md:pb-20');
    expect(library).toContain('hidden md:block"><SettingsButton /></div>');
    expect(library).toContain('resumeAvailable={Boolean(featured)}');
    expect(library).toContain('else setBrowse(true)');
  });
});
