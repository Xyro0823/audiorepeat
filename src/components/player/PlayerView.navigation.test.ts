import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(join(process.cwd(), 'src/components/player/PlayerView.tsx'), 'utf8');

describe('PlayerView library navigation', () => {
  it('routes every library back-link to the dashboard rather than the landing page', () => {
    expect(source).toContain("const LIBRARY_HREF = '/dashboard';");
    expect(source.match(/href=\{LIBRARY_HREF\}/g)).toHaveLength(2);
    expect(source.match(/scroll=\{false\}/g)?.length).toBeGreaterThanOrEqual(2);
    expect(source).toContain('router.back();');
  });
});
