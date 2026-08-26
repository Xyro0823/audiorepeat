import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(join(process.cwd(), 'src/components/player/PlayerView.tsx'), 'utf8');

describe('mobile player gestures', () => {
  it('has a phone-only focus mode with an always available exit action', () => {
    expect(source).toContain("focusMode ? 'max-md:hidden' : ''");
    expect(source).toContain("t('player.focus.exitAria')");
  });

  it('only accepts deliberate swipes away from interactive controls', () => {
    expect(source).toContain("target.closest('button, a, input, select, textarea, label')");
    expect(source).toContain('Math.abs(horizontal) < 72');
    expect(source).toContain('onPointerDown={onWordPointerDown} onPointerUp={onWordPointerUp}');
  });
});
