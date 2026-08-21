import { describe, expect, it } from 'vitest';
import { buildBackup, parseBackup } from './backup';
import { DEFAULT_SETTINGS, type VocabSet } from '@/types/app';

const set: VocabSet = {
  id: 'set-1', name: 'Spanish', lang: 'es-ES', nativeLang: 'en-US',
  words: [{
    id: 'w1',
    target: ' hola ',
    translation: ' hello ',
    mastery: 'mastered',
    review: {
      due: 1_800_000_000_000,
      stability: 5.4,
      difficulty: 4.2,
      elapsedDays: 2,
      scheduledDays: 5,
      learningSteps: 0,
      reps: 3,
      lapses: 1,
      state: 2,
      lastReview: 1_700_000_000_000,
    },
  }],
  createdAt: 1, updatedAt: 2,
};

describe('backup round trip', () => {
  it('restores current days, sets, and default new-set language', () => {
    const text = buildBackup({
      settings: { ...DEFAULT_SETTINGS, defaultNewSetLang: 'ja-JP' },
      sets: [set],
      days: { '2026-08-19': { w: 3, ms: 900 } },
    });
    const parsed = parseBackup(text);
    expect(parsed?.settings?.defaultNewSetLang).toBe('ja-JP');
    expect(parsed?.sets?.[0].words[0]).toMatchObject({ target: 'hola', translation: 'hello' });
    expect(parsed?.sets?.[0].words[0].review).toEqual(set.words[0].review);
    expect(parsed?.days?.['2026-08-19']).toEqual({ w: 3, ms: 900 });
  });

  it('keeps the legacy stats fallback and rejects malformed documents', () => {
    expect(parseBackup(JSON.stringify({ format: 'audiorepeat-backup', stats: { '2026-08-19': { w: 1, ms: 0 } } }))?.days)
      .toEqual({ '2026-08-19': { w: 1, ms: 0 } });
    expect(parseBackup('{bad')).toBeNull();
    expect(parseBackup(JSON.stringify({ format: 'other' }))).toBeNull();
  });
});
