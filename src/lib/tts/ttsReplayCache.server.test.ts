import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
  getCachedTtsAudio,
  resetTtsReplayCacheForTests,
  storeTtsAudio,
  ttsReplayKey,
} from './ttsReplayCache.server';

function audio(byte: number): ArrayBuffer {
  return new Uint8Array([byte]).buffer;
}

describe('ttsReplayCache.server', () => {
  it('round-trips a stored synthesis and expires it after the TTL', () => {
    resetTtsReplayCacheForTests();
    const key = ttsReplayKey('uid-1', 'es-ES', 'hola');
    storeTtsAudio(key, audio(1), 'es-ES-Standard', 1000);
    expect(getCachedTtsAudio(key, 2000)).toMatchObject({ voice: 'es-ES-Standard' });
    // TTL is 10 minutes — just past it the entry must be gone (fail open to
    // normal synthesis, never serve stale audio).
    expect(getCachedTtsAudio(key, 1000 + 10 * 60_000)).toBeNull();
    expect(getCachedTtsAudio(key, 1000 + 10 * 60_000 + 1)).toBeNull();
  });

  it('keys on uid + lang + text so different callers or words never collide', () => {
    resetTtsReplayCacheForTests();
    storeTtsAudio(ttsReplayKey('uid-1', 'es-ES', 'hola'), audio(1), 'v1', 0);
    expect(getCachedTtsAudio(ttsReplayKey('uid-2', 'es-ES', 'hola'), 1)).toBeNull();
    expect(getCachedTtsAudio(ttsReplayKey('uid-1', 'en-US', 'hola'), 1)).toBeNull();
    expect(getCachedTtsAudio(ttsReplayKey('uid-1', 'es-ES', 'adiós'), 1)).toBeNull();
  });

  it('evicts the least recently stored entries beyond the bounded capacity', () => {
    resetTtsReplayCacheForTests();
    const keys: string[] = [];
    for (let i = 0; i < 301; i += 1) {
      const key = ttsReplayKey(`uid-${i}`, 'es-ES', 'hola');
      keys.push(key);
      storeTtsAudio(key, audio(i % 256), 'v', i);
    }
    // Oldest entry evicted, newest retained — memory stays bounded.
    expect(getCachedTtsAudio(keys[0], 301)).toBeNull();
    expect(getCachedTtsAudio(keys[300], 301)).not.toBeNull();
  });

  it('refreshes recency when a key is re-stored', () => {
    resetTtsReplayCacheForTests();
    const hot = ttsReplayKey('hot', 'es-ES', 'hola');
    storeTtsAudio(hot, audio(1), 'v', 0);
    for (let i = 0; i < 300; i += 1) {
      storeTtsAudio(ttsReplayKey(`uid-x-${i}`, 'es-ES', 'x'), audio(1), 'v', i + 1);
    }
    storeTtsAudio(hot, audio(2), 'v2', 400);
    for (let i = 0; i < 5; i += 1) {
      storeTtsAudio(ttsReplayKey(`uid-y-${i}`, 'es-ES', 'y'), audio(1), 'v', 500 + i);
    }
    expect(getCachedTtsAudio(hot, 600)).toMatchObject({ voice: 'v2' });
  });
});
