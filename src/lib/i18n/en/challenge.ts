/** English strings for the speed challenge (keys are the source of truth). */
export const challengeEn = {
  // ---- Intro screen ----
  'challenge.intro.title': '1-Minute Challenge',
  'challenge.intro.setMeta': '{name} · {count} words',
  'challenge.intro.description':
    'Hear each word and pick its translation as fast as you can — how many can you get in {seconds} seconds?',
  'challenge.intro.personalBest.one': '⚡ Personal best: {score} · {plays} play',
  'challenge.intro.personalBest.other': '⚡ Personal best: {score} · {plays} plays',
  'challenge.intro.start': '▶ Start',

  // ---- Playing screen ----
  'challenge.playing.timer': '{seconds}s',
  'challenge.playing.score': 'Score',
  'challenge.playing.exitAria': 'Exit challenge',
  'challenge.playing.exitTitle': 'Exit — the current run is not saved',
  'challenge.playing.pickTranslation': '{index} · pick the translation',
  'challenge.playing.replayWord': 'Replay word',

  // ---- Answer feedback ----
  'challenge.answer.correct': '✓ Correct!',
  'challenge.answer.wasAnswer': '✗ It was "{answer}"',

  // ---- Finish screen ----
  'challenge.finish.title': "Time's up!",
  'challenge.finish.subtitle': 'correct in {seconds} seconds',
  'challenge.finish.newBest': '🏆 New personal best!',
  'challenge.finish.best.one': 'Best: {score} · {plays} play',
  'challenge.finish.best.other': 'Best: {score} · {plays} plays',
  'challenge.finish.playAgain': '↻ Play again',
} as const;

export type ChallengeKeys = keyof typeof challengeEn;
