import { describe, expect, it, vi } from 'vitest';
import { prewarmSetAudio } from './cloudTts';

describe('disabled remote TTS prewarm', () => {
  it('reports zero work and performs no network request', () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const progress = vi.fn();
    const cancel = prewarmSetAudio(
      [{ id: '1', target: 'private vocabulary', translation: 'secret' }],
      { lang: 'en-US', onProgress: progress },
    );
    expect(progress).toHaveBeenCalledWith(0, 0, 0, 0);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(() => cancel()).not.toThrow();
    vi.unstubAllGlobals();
  });
});
