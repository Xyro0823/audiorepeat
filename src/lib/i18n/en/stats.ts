/** English strings for the stats area (keys are the source of truth). */
export const statsEn = {
  // ---- Pro lock screen ----
  'stats.lock.title': 'Practice stats',
  'stats.lock.body':
    'Streaks, heatmaps and word history are part of Pro. Keep listening and dictation practice on the Free plan.',

  // ---- Header ----
  'stats.backAria': 'Back to library',
  'stats.library': 'Library',
  'stats.title': 'Stats',

  // ---- Streak hero ----
  'stats.dayStreak': 'day streak',
  'stats.streakSummary': 'Best: {best} days · {active} active days',

  // ---- Period tiles ('Today' reuses common.today) ----
  'stats.period.allTime': 'All time',
  'stats.metric.wordsListened': 'words listened',
  'stats.metric.studyTime': 'study time',

  // ---- Empty state ----
  'stats.empty.title': 'No practice yet',
  'stats.empty.body':
    'Open a set and press play — your streak and stats will start building here.',
  'stats.empty.backLibrary': 'Back to library',

  // ---- Sections ----
  'stats.week.title': 'This week',
  'stats.month.title': 'Last 30 days',
  'stats.month.activeDays': '{count} active days',
  'stats.legend.less': 'Less',
  'stats.legend.more': 'More',
  'stats.weekly.title': 'Last 8 weeks',
  'stats.weekly.sub': 'words listened per week',
  'stats.weekly.barTitle': 'Week of {label} — {words} words · {time}',

  // ---- Heatmap cell tooltip (ActivityHeatmap) ----
  'stats.heatmap.cellNone': '{head} — no practice',
  'stats.heatmap.cellOne': '{head} — {count} word · {time}',
  'stats.heatmap.cellMany': '{head} — {count} words · {time}',

  // ---- StreakBadge titles ----
  'stats.badge.activeTitle': '{count}-day practice streak',
  'stats.badge.inactiveTitle': 'No streak yet — practice today to start one',
} as const;

export type StatsKeys = keyof typeof statsEn;
