import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(join(process.cwd(), 'src/components/pwa/UpdatePrompt.tsx'), 'utf8');

describe('UpdatePrompt', () => {
  it('moves above the fixed dashboard navigation on phones', () => {
    expect(source).toContain('pathname === "/dashboard"');
    expect(source).toContain('bottom-[calc(env(safe-area-inset-bottom)+6.25rem)] md:bottom-4');
    expect(source).toContain('z-[70]');
  });
});
