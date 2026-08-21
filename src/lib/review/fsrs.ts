import { createEmptyCard, fsrs, Rating, type Card, type Grade } from 'ts-fsrs';
import type { MasteryStatus, ReviewSchedule, VocabSet, VocabWord } from '@/types/app';

export type ReviewRating = 'again' | 'hard' | 'good';

export interface DueReviewItem {
  setId: string;
  setName: string;
  lang: string;
  nativeLang: string;
  word: VocabWord;
  dueAt: number;
}

const DAY_MS = 86_400_000;
const scheduler = fsrs({
  request_retention: 0.9,
  maximum_interval: 3650,
  enable_fuzz: true,
  enable_short_term: false,
  learning_steps: [],
  relearning_steps: [],
});

function toCard(schedule: ReviewSchedule | undefined, now: Date): Card {
  if (!schedule) return createEmptyCard(now);
  return {
    due: new Date(schedule.due),
    stability: schedule.stability,
    difficulty: schedule.difficulty,
    elapsed_days: schedule.elapsedDays,
    scheduled_days: schedule.scheduledDays,
    learning_steps: schedule.learningSteps,
    reps: schedule.reps,
    lapses: schedule.lapses,
    state: schedule.state,
    last_review: schedule.lastReview === undefined ? undefined : new Date(schedule.lastReview),
  };
}

function fromCard(card: Card): ReviewSchedule {
  return {
    due: card.due.getTime(),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsedDays: card.elapsed_days,
    scheduledDays: card.scheduled_days,
    learningSteps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
    lastReview: card.last_review?.getTime(),
  };
}

function fsrsRating(rating: ReviewRating): Grade {
  if (rating === 'again') return Rating.Again as Grade;
  if (rating === 'hard') return Rating.Hard as Grade;
  return Rating.Good as Grade;
}

/** Apply a recall result and persist the next FSRS due date. */
export function applyReviewRating(
  word: VocabWord,
  rating: ReviewRating,
  now = new Date(),
): VocabWord {
  const result = scheduler.next(toCard(word.review, now), now, fsrsRating(rating));
  return {
    ...word,
    mastery: rating === 'good' ? 'mastered' : 'hard',
    review: fromCard(result.card),
  };
}

/** Map the player's existing Known / Review controls into FSRS. */
export function applyMasteryStatus(
  word: VocabWord,
  status: MasteryStatus | undefined,
  now = new Date(),
): VocabWord {
  if (!status) return { ...word, mastery: undefined, review: undefined };
  const next = applyReviewRating(word, status === 'mastered' ? 'good' : 'hard', now);
  // An explicit "Review" mark means the learner wants this word in today's queue.
  return status === 'hard' && next.review
    ? { ...next, review: { ...next.review, due: now.getTime() } }
    : next;
}

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/**
 * Legacy Known words predate FSRS. Spread them deterministically across seven
 * days so an upgrade never dumps an entire library into one review session.
 */
function legacyKnownDue(word: VocabWord, setId: string, nowMs: number): boolean {
  const day = Math.floor(nowMs / DAY_MS);
  return stableHash(`${setId}:${word.id}`) % 7 === day % 7;
}

export function buildDueReviewQueue(
  sets: VocabSet[],
  now = new Date(),
  limit = Number.POSITIVE_INFINITY,
): DueReviewItem[] {
  const nowMs = now.getTime();
  const due: DueReviewItem[] = [];
  for (const set of sets) {
    for (const word of set.words) {
      let dueAt: number | null = null;
      if (word.review && word.review.due <= nowMs) dueAt = word.review.due;
      else if (!word.review && word.mastery === 'hard') dueAt = 0;
      else if (!word.review && word.mastery === 'mastered' && legacyKnownDue(word, set.id, nowMs)) {
        dueAt = nowMs;
      }
      if (dueAt === null) continue;
      due.push({
        setId: set.id,
        setName: set.name,
        lang: set.lang,
        nativeLang: set.nativeLang,
        word,
        dueAt,
      });
    }
  }
  due.sort((a, b) => a.dueAt - b.dueAt || a.setName.localeCompare(b.setName));
  return due.slice(0, Math.max(0, limit));
}

export function estimatedReviewMinutes(wordCount: number): number {
  if (wordCount <= 0) return 0;
  return Math.max(1, Math.ceil((Math.min(wordCount, 30) * 12) / 60));
}
