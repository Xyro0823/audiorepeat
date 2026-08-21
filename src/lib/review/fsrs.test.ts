import { describe, expect, it } from 'vitest';
import { applyMasteryStatus, applyReviewRating, buildDueReviewQueue, estimatedReviewMinutes } from './fsrs';
import type { VocabSet, VocabWord } from '@/types/app';

const now = new Date('2026-08-20T03:00:00.000Z');
const word = (id: string, mastery?: VocabWord['mastery']): VocabWord => ({
  id,
  target: `target-${id}`,
  translation: `translation-${id}`,
  mastery,
});
const set = (words: VocabWord[]): VocabSet => ({
  id: 'set-1',
  name: 'Spanish',
  lang: 'es-ES',
  nativeLang: 'en-US',
  words,
  createdAt: now.getTime(),
  updatedAt: now.getTime(),
});

describe('FSRS review scheduling', () => {
  it('stores a future due date after a successful recall', () => {
    const reviewed = applyReviewRating(word('a'), 'good', now);
    expect(reviewed.mastery).toBe('mastered');
    expect(reviewed.review?.reps).toBe(1);
    expect(reviewed.review!.due).toBeGreaterThan(now.getTime());
  });

  it('places an explicit Review mark into today’s queue', () => {
    const reviewed = applyMasteryStatus(word('b'), 'hard', now);
    expect(reviewed.review?.due).toBe(now.getTime());
    expect(buildDueReviewQueue([set([reviewed])], now)).toHaveLength(1);
  });

  it('removes FSRS state when a mastery mark is cleared', () => {
    const reviewed = applyReviewRating(word('c'), 'good', now);
    expect(applyMasteryStatus(reviewed, undefined, now)).toMatchObject({
      mastery: undefined,
      review: undefined,
    });
  });

  it('excludes unmarked learning words and future scheduled words', () => {
    const future = applyReviewRating(word('d'), 'good', now);
    expect(buildDueReviewQueue([set([word('new'), future])], now)).toHaveLength(0);
  });

  it('limits a session and estimates a five-to-six minute maximum session', () => {
    const hard = Array.from({ length: 50 }, (_, i) => word(String(i), 'hard'));
    expect(buildDueReviewQueue([set(hard)], now, 30)).toHaveLength(30);
    expect(estimatedReviewMinutes(30)).toBe(6);
  });
});
