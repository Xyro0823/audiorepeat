import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(join(process.cwd(), 'src/components/library/StarterLibraryModal.tsx'), 'utf8');
const topics = readFileSync(join(process.cwd(), 'src/components/library/TopicLibraryTab.tsx'), 'utf8');
const virtualList = readFileSync(join(process.cwd(), 'src/components/library/VirtualList.tsx'), 'utf8');

describe('StarterLibraryModal', () => {
  it('prevents library scrolling from propagating to the dashboard', () => {
    expect(source).toContain("document.body.style.overflow = 'hidden'");
    expect(source).toContain('overflow-hidden px-6 py-4');
    expect(source).toContain('max-h-[90dvh] min-h-0');
    expect(topics).toContain('overflow-y-auto overscroll-contain');
    expect(virtualList).toContain('touch-pan-y overflow-y-auto overscroll-contain');
    expect(virtualList).toContain('min(${height}px, 28dvh)');
    expect(source).toContain('responsiveHeight');
  });
});
