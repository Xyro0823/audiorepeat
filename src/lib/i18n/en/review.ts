/** English strings for the review area (keys are the source of truth). */
export const reviewEn = {
  // ---- Pro lock screen ----
  'review.lock.title': 'Spaced repetition review',
  'review.lock.body':
    'FSRS scheduling, review sessions and word mastery marks are part of Pro. Keep listening and dictation practice on the Free plan.',

  // ---- Nothing due (empty state) ----
  'review.empty.eyebrow': 'Review Today',
  'review.empty.title': 'Nothing due right now',
  'review.empty.body':
    'Mark difficult words as Review while listening. Known words will rotate into this queue over time.',
  'review.backToDashboard': 'Back to dashboard',

  // ---- Session complete state ----
  'review.done.eyebrow': 'Session complete',
  'review.done.title': '{count} words strengthened',
  'review.done.body':
    'FSRS has scheduled each word for the moment you are most likely to need it again.',

  // ---- Session header ----
  'review.dashboardCrumb': '← Dashboard',
  'review.header.title': 'Review Today',
  'review.timeLeft': 'about {minutes} min left',
  'review.session.queue': 'Memory queue',
  'review.session.remaining': 'Remaining',

  // ---- Word card actions ----
  'review.hearWord': 'Hear word',
  'review.speaking': 'Speaking…',
  'review.showAnswer': 'Show answer',

  // ---- Cloud voice consent ----
  'review.cloud.title': 'Cloud voice needed',
  'review.cloud.body':
    'This device has no voice for this language. Only the word being spoken is sent to Microsoft Azure.',
  'review.cloud.enable': 'Enable cloud voice',
  'review.cloud.enableSignIn': 'Sign in & enable cloud voice',

  // ---- Rating controls ----
  'review.rate.prompt': 'How well did you remember?',
  'review.rate.again': 'Again',
  'review.rate.againHint': '< 1 day',
  'review.rate.review': 'Review',
  'review.rate.soonHint': 'Sooner',
  'review.rate.known': 'Known',
  'review.rate.laterHint': 'Later',

  // ---- Errors ----
  'review.error.saveFailed': 'Could not save this review. Try the rating again.',
} as const;

export type ReviewKeys = keyof typeof reviewEn;
