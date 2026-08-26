import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (file: string) => readFileSync(join(process.cwd(), file), 'utf8');

describe('mobile layout guardrails', () => {
  it('keeps the Settings dialog usable above mobile browser chrome', () => {
    const source = read('src/components/settings/SettingsModal.tsx');
    expect(source).toContain('flex items-end justify-center');
    expect(source).toContain('max-h-[92dvh]');
    expect(source).toContain('env(safe-area-inset-bottom)');
  });

  it('reserves enough vertical space for the two-row mobile player dock', () => {
    const source = read('src/components/player/PlayerView.tsx');
    expect(source).toContain('px-4 pb-64 pt-5 sm:px-5 sm:pb-52 sm:pt-6');
  });

  it('wraps long target words and translations instead of overflowing on phones', () => {
    const source = read('src/components/player/WordCard.tsx');
    expect(source).toContain('max-w-full break-words px-2 text-4xl');
    expect(source).toContain('max-w-full break-words px-2 text-xl');
  });
});
