import { afterAll, describe, expect, it, vi } from 'vitest';
import { decodeSetFromUrl, encodeSetForUrl, shareUrlForSet } from './share';
import type { VocabSet } from '@/types/app';

vi.stubGlobal('crypto', { randomUUID: () => 'fresh-id' });

const set: VocabSet = {
  id: 'private-id',
  name: 'Travel Spanish',
  lang: 'es-ES',
  nativeLang: 'en-US',
  words: [{
    id: 'word-1',
    target: 'hola',
    translation: 'hello',
    mastery: 'mastered',
    review: {
      due: 123,
      stability: 4,
      difficulty: 5,
      elapsedDays: 1,
      scheduledDays: 3,
      learningSteps: 0,
      reps: 2,
      lapses: 0,
      state: 2,
    },
  }],
  createdAt: 1,
  updatedAt: 1,
  settings: {
    repeats: 3,
    speed: 0.8,
    plan: 'lifetime',
    hiddenLangs: ['secret'],
    cloudTts: true,
  },
};

afterAll(() => vi.unstubAllGlobals());

describe('set sharing', () => {
  it('round-trips set content without personal mastery or review history', () => {
    const decoded = decodeSetFromUrl(encodeSetForUrl(set));
    expect(decoded?.words[0]).toMatchObject({ target: 'hola', translation: 'hello' });
    expect(decoded?.words[0].mastery).toBeUndefined();
    expect(decoded?.words[0].review).toBeUndefined();
    expect(decoded?.settings).toMatchObject({ repeats: 3, speed: 0.8 });
    expect(decoded?.settings).not.toHaveProperty('plan');
    expect(decoded?.settings).not.toHaveProperty('hiddenLangs');
    expect(decoded?.settings).not.toHaveProperty('cloudTts');
  });

  it('keeps the payload in a URL fragment so it is not sent to the server', () => {
    const url = shareUrlForSet(set);
    expect(url).toContain('/dashboard#set=');
    expect(url).not.toContain('?set=');
  });
});
