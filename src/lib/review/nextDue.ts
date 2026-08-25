import type { VocabSet } from '@/types/app';
import type { TKey, TVars } from '@/lib/i18n';

/**
 * Read-only helpers that surface the NEXT scheduled review moment. They only
 * read the `review.due` timestamps FSRS already wrote — scheduling math is
 * never touched here.
 */

const DAY_MS = 86_400_000;

/** Earliest future due timestamp across the library, or null when none. */
export function nextDueAt(sets: VocabSet[], now = new Date()): number | null {
  const nowMs = now.getTime();
  let min: number | null = null;
  for (const set of sets) {
    for (const word of set.words) {
      const due = word.review?.due;
      if (typeof due !== 'number' || due <= nowMs) continue;
      if (min === null || due < min) min = due;
    }
  }
  return min;
}

export type NextDueInfo =
  | { kind: 'today' }
  | { kind: 'tomorrow' }
  | { kind: 'days'; count: number }
  | { kind: 'date'; date: Date };

/** Bucket a due timestamp into calendar-day distance from `now` (local time). */
export function classifyNextDue(dueMs: number, now = new Date()): NextDueInfo {
  const startOfDayMs = (d: Date): number =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const due = new Date(dueMs);
  const diffDays = Math.round((startOfDayMs(due) - startOfDayMs(now)) / DAY_MS);
  if (diffDays <= 0) return { kind: 'today' };
  if (diffDays === 1) return { kind: 'tomorrow' };
  if (diffDays <= 14) return { kind: 'days', count: diffDays };
  return { kind: 'date', date: due };
}

export interface NextDueCopy {
  key: TKey;
  vars?: TVars;
  /** Set when the copy needs a locale-formatted date placeholder. */
  date?: Date;
}

/** Map a NextDueInfo onto its i18n key + interpolation vars. */
export function nextDueCopy(info: NextDueInfo): NextDueCopy {
  switch (info.kind) {
    case 'today':
      return { key: 'dashboard.review.nextDue.today' };
    case 'tomorrow':
      return { key: 'dashboard.review.nextDue.tomorrow' };
    case 'days':
      return {
        key:
          info.count === 1
            ? 'dashboard.review.nextDue.days.one'
            : 'dashboard.review.nextDue.days.other',
        vars: { count: info.count },
      };
    case 'date':
      return { key: 'dashboard.review.nextDue.date', date: info.date };
  }
}

/** Locale-aware short date for the {date} placeholder ('Aug 30'). */
export function formatNextDueDate(date: Date, lang: string): string {
  try {
    return new Intl.DateTimeFormat(lang, { month: 'short', day: 'numeric' }).format(date);
  } catch {
    return date.toLocaleDateString();
  }
}
