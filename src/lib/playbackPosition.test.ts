import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearPlaybackPosition,
  playbackPositionKey,
  readPlaybackPosition,
  savePlaybackPosition,
} from '@/lib/playbackPosition';

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() { return map.size; },
    clear: () => map.clear(),
    getItem: (key: string) => map.get(key) ?? null,
    key: (index: number) => [...map.keys()][index] ?? null,
    removeItem: (key: string) => { map.delete(key); },
    setItem: (key: string, value: string) => { map.set(key, String(value)); },
  } as Storage;
}

beforeEach(() => {
  vi.spyOn(Date, 'now').mockReturnValue(123_456);
  (globalThis as unknown as { window: unknown }).window = { localStorage: memoryStorage() };
});

afterEach(() => {
  vi.restoreAllMocks();
  (globalThis as unknown as { window: unknown }).window = undefined;
});

describe('playback position persistence', () => {
  it('keeps each account and set isolated', () => {
    expect(playbackPositionKey('user-a', 'set-1')).not.toBe(playbackPositionKey('user-b', 'set-1'));
    expect(playbackPositionKey('user-a', 'set-1')).not.toBe(playbackPositionKey('user-a', 'set-2'));
    expect(playbackPositionKey(null, 'set-1')).not.toBe(playbackPositionKey('user-a', 'set-1'));
  });

  it('stores the stable word id instead of a fragile list index', () => {
    savePlaybackPosition('user-a', 'set-1', 'word-mn-welcome');
    expect(readPlaybackPosition('user-a', 'set-1')).toEqual({
      wordId: 'word-mn-welcome',
      updatedAt: 123_456,
    });
  });

  it('clears a saved position and rejects corrupted storage', () => {
    savePlaybackPosition('user-a', 'set-1', 'word-1');
    clearPlaybackPosition('user-a', 'set-1');
    expect(readPlaybackPosition('user-a', 'set-1')).toBeNull();
    window.localStorage.setItem(playbackPositionKey('user-a', 'set-1'), '{broken');
    expect(readPlaybackPosition('user-a', 'set-1')).toBeNull();
  });
});
