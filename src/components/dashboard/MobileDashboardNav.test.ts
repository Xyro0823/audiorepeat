import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(join(process.cwd(), 'src/components/dashboard/MobileDashboardNav.tsx'), 'utf8');
const library = readFileSync(join(process.cwd(), 'src/components/library/SetLibrary.tsx'), 'utf8');

describe('MobileDashboardNav', () => {
  it('keeps thumb navigation phone-only and reserves a distinct primary resume action', () => {
    expect(source).toContain('md:hidden');
    expect(source).toContain('BrowserNavItem');
    expect(source).toContain('fixed inset-x-0 top-0 z-[60]');
    expect(source).toContain('installed PWA keeps its app shell');
    expect(source).toContain("onTabChange('review')");
    expect(source).toContain("onTabChange('library')");
    expect(source).toContain('activeTab === \'home\'');
  });

  it('keeps bottom navigation clear of dashboard content and desktop utility controls', () => {
    expect(library).toContain('pb-28 pt-3 xl:pl-[340px] md:pb-20');
    expect(library).toContain('href="/settings"');
    expect(library).toContain('xl:hidden');
    expect(library).toContain('resumeAvailable={Boolean(featured)}');
    expect(library).toContain('activeTab={mobileTab}');
    expect(library).toContain('else setBrowse(true)');
  });
});
