import { describe, expect, it } from 'vitest';
import { applyBulkWordProgress, deleteSelectedWords } from './bulkWordActions';
import type { VocabWord } from '@/types/app';

const now = new Date('2026-08-20T03:00:00.000Z');

const words: VocabWord[] = [
  {
    id: 'draft-1',
    target: ' unsaved target ',
    translation: 'unsaved translation',
    repeats: 5,
    example: 'an unsaved example',
  },
  {
    id: 'known-2',
    target: 'hola',
    translation: 'hello',
    mastery: 'mastered',
    review: {
      due: now.getTime() + 86_400_000,
      stability: 1,
      difficulty: 5,
      elapsedDays: 0,
      scheduledDays: 1,
      learningSteps: 0,
      reps: 1,
      lapses: 0,
      state: 2,
      lastReview: now.getTime(),
    },
  },
];

describe('bulk word actions', () => {
  it('marks only selected draft words Known without losing unsaved fields', () => {
    const result = applyBulkWordProgress(words, new Set(['draft-1']), 'mastered', now);

    expect(result[0]).toMatchObject({
      target: ' unsaved target ',
      translation: 'unsaved translation',
      repeats: 5,
      example: 'an unsaved example',
      mastery: 'mastered',
    });
    expect(result[0].review?.due).toBeGreaterThan(now.getTime());
    expect(result[1]).toBe(words[1]);
  });

  it('marks selected words Review and makes them due immediately', () => {
    const result = applyBulkWordProgress(words, new Set(['draft-1']), 'hard', now);

    expect(result[0].mastery).toBe('hard');
    expect(result[0].review?.due).toBe(now.getTime());
  });

  it('resets both mastery and FSRS progress only for selected words', () => {
    const result = applyBulkWordProgress(words, new Set(['known-2']), 'reset', now);

    expect(result[1].mastery).toBeUndefined();
    expect(result[1].review).toBeUndefined();
    expect(result[1].target).toBe('hola');
    expect(result[0]).toBe(words[0]);
  });

  it('deletes exactly the confirmed ids from the current draft', () => {
    const result = deleteSelectedWords(words, new Set(['known-2', 'missing-id']));

    expect(result).toEqual([words[0]]);
  });

  it('returns the original draft when selection is empty', () => {
    expect(applyBulkWordProgress(words, new Set(), 'mastered', now)).toBe(words);
    expect(deleteSelectedWords(words, new Set())).toBe(words);
  });
});
