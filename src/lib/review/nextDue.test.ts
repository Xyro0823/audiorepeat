import { describe, expect, it } from 'vitest';
import type { VocabSet } from '@/types/app';
import {
  classifyNextDue,
  formatNextDueDate,
  nextDueAt,
  nextDueCopy,
} from './nextDue';

function setWithDue(id: string, due: number | undefined): VocabSet {
  return {
    id,
    name: id,
    lang: 'ja-JP',
    words: [
      {
        id: `${id}-w1`,
        target: 'target',
        translation: 'translation',
        ...(due === undefined ? {} : { review: { due } } as object),
      },
    ],
  } as unknown as VocabSet;
}

const NOW = new Date('2026-08-25T12:00:00');
const at = (dayOffset: number): number =>
  new Date(
    NOW.getFullYear(),
    NOW.getMonth(),
    NOW.getDate() + dayOffset,
    9,
  ).getTime();

describe('nextDueAt', () => {
  it('returns null for an empty library', () => {
    expect(nextDueAt([], NOW)).toBeNull();
  });

  it('ignores past-due and unscheduled words', () => {
    const sets = [setWithDue('a', NOW.getTime() - 1000), setWithDue('b', undefined)];
    expect(nextDueAt(sets, NOW)).toBeNull();
  });

  it('picks the earliest future due timestamp', () => {
    const sets = [setWithDue('a', at(3)), setWithDue('b', at(1)), setWithDue('c', at(7))];
    expect(nextDueAt(sets, NOW)).toBe(at(1));
  });
});

describe('classifyNextDue', () => {
  it('buckets same-day dues as today (even later hours)', () => {
    expect(classifyNextDue(at(0), NOW)).toEqual({ kind: 'today' });
  });

  it('buckets tomorrow', () => {
    expect(classifyNextDue(at(1), NOW)).toEqual({ kind: 'tomorrow' });
  });

  it('buckets short horizons as a day count', () => {
    expect(classifyNextDue(at(6), NOW)).toEqual({ kind: 'days', count: 6 });
    expect(classifyNextDue(at(14), NOW)).toEqual({ kind: 'days', count: 14 });
  });

  it('falls back to an absolute date beyond two weeks', () => {
    const info = classifyNextDue(at(20), NOW);
    expect(info.kind).toBe('date');
    if (info.kind === 'date') expect(info.date.getTime()).toBe(at(20));
  });
});

describe('nextDueCopy + formatNextDueDate', () => {
  it('maps every bucket onto a translated key', () => {
    expect(nextDueCopy({ kind: 'today' }).key).toBe('dashboard.review.nextDue.today');
    expect(nextDueCopy({ kind: 'tomorrow' }).key).toBe('dashboard.review.nextDue.tomorrow');
    expect(nextDueCopy({ kind: 'days', count: 3 }).vars).toEqual({ count: 3 });
    expect(nextDueCopy({ kind: 'days', count: 1 }).key).toBe(
      'dashboard.review.nextDue.days.one',
    );
    const dateCopy = nextDueCopy({ kind: 'date', date: new Date(at(20)) });
    expect(dateCopy.key).toBe('dashboard.review.nextDue.date');
    expect(formatNextDueDate(new Date(at(20)), 'en')).toMatch(/\d/);
  });
});
