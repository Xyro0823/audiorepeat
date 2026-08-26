import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(join(process.cwd(), 'src/components/library/SetLibrary.tsx'), 'utf8');

describe('PortraitCard action layout', () => {
  it('stacks localized actions so neither label is squeezed inside a card', () => {
    expect(source).toContain('grid grid-cols-1 gap-2');
    expect(source).not.toContain('sm:grid-cols-2');
    expect(source).not.toContain('sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]');
  });
});
