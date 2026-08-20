import { describe, expect, it } from 'vitest';
import { clampWordIndex, previousWordIndex } from '@/lib/playerNavigation';

describe('previousWordIndex', () => {
  it('moves to the previous word', () => {
    expect(previousWordIndex(5, 254)).toBe(4);
  });

  it('wraps the first word to the last word', () => {
    expect(previousWordIndex(0, 254)).toBe(253);
  });

  it('is safe for an empty playlist', () => {
    expect(previousWordIndex(0, 0)).toBe(0);
  });
});

describe('clampWordIndex', () => {
  it('keeps a valid requested word', () => {
    expect(clampWordIndex(128, 254)).toBe(128);
  });

  it('clamps requests before and after the playlist', () => {
    expect(clampWordIndex(-5, 254)).toBe(0);
    expect(clampWordIndex(999, 254)).toBe(253);
  });

  it('is safe for empty and invalid requests', () => {
    expect(clampWordIndex(20, 0)).toBe(0);
    expect(clampWordIndex(Number.NaN, 254)).toBe(0);
  });
});
