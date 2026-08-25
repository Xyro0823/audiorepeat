import { describe, expect, it } from 'vitest';
import { dayKey, daysSinceLastPractice, type DayMap } from './practiceStats';

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return dayKey(d);
}

describe('daysSinceLastPractice', () => {
  it('returns null when nothing was ever recorded', () => {
    expect(daysSinceLastPractice({})).toBeNull();
  });

  it('ignores placeholder days with zero activity', () => {
    const days: DayMap = { [daysAgo(3)]: { w: 0, ms: 0 } };
    expect(daysSinceLastPractice(days)).toBeNull();
  });

  it('returns 0 for activity today', () => {
    const days: DayMap = { [daysAgo(0)]: { w: 5, ms: 60_000 } };
    expect(daysSinceLastPractice(days)).toBe(0);
  });

  it('counts whole days since the latest active day', () => {
    const days: DayMap = {
      [daysAgo(5)]: { w: 2, ms: 30_000 },
      [daysAgo(2)]: { w: 1, ms: 10_000 },
    };
    expect(daysSinceLastPractice(days)).toBe(2);
  });

  it('counts ms-only days as practice too', () => {
    const days: DayMap = { [daysAgo(4)]: { w: 0, ms: 500 } };
    expect(daysSinceLastPractice(days)).toBe(4);
  });
});
