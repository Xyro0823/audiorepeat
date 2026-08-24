import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('./SetEditor.tsx', import.meta.url), 'utf8');

describe('SetEditor bulk-action safeguards', () => {
  it('keeps selection controls labelled and exposes grouped bulk actions', () => {
    expect(source).toContain("aria-label={allSelected ? t('library.editor.deselectAll') : t('library.editor.selectAll')}");
    expect(source).toContain("aria-label={t('library.bulk.actionsAria')}");
    expect(source).toContain('aria-live="polite"');
  });

  it('requires an in-editor confirmation before deletion', () => {
    expect(source).toContain("t('library.confirmDelete')");
    expect(source).toContain("t('library.keepWords')");
    expect(source).not.toContain('window.confirm');
  });

  it('uses wrapping and min-width containment for narrow viewports', () => {
    expect(source).toContain('overflow-x-hidden');
    expect(source).toContain('flex flex-wrap gap-2');
    expect(source).toContain('grid-cols-[auto_minmax(0,1fr)]');
    expect(source).toContain('sticky top-0');
  });
});
