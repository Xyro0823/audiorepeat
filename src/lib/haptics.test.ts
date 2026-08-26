import { describe, expect, it, vi } from 'vitest';
import { haptic } from './haptics';

describe('haptic', () => {
  it('uses a brief vibration when the browser supports it', () => {
    const vibrate = vi.fn();
    vi.stubGlobal('navigator', { vibrate });
    haptic('confirm');
    expect(vibrate).toHaveBeenCalledWith([10, 35, 12]);
    vi.unstubAllGlobals();
  });
});
