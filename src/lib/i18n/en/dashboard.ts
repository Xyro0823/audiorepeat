/**
 * English strings for the dashboard area (keys are the source of truth).
 * Also carries shared copy for components rendered from the dashboard shell
 * (PWA install extras, Pro lock screen, error-boundary link).
 */
export const dashboardEn = {
  // WelcomeHero
  'dashboard.welcome.back': 'Welcome back',
  'dashboard.welcome.title': 'Ready to train your ears?',
  'dashboard.welcome.subtitle':
    'Loop, repeat and retain vocabulary hands-free. A few focused minutes today keep your streak alive.',
  'dashboard.welcome.startLearning': 'Start learning',
  'dashboard.chips.wordsToday.one': '{count} word today',
  'dashboard.chips.wordsToday.other': '{count} words today',
  'dashboard.chips.studied': '{time} studied',
  'dashboard.chips.streakStart': 'Start a streak',

  // MobileDashboardNav
  'dashboard.mobileNav.aria': 'Dashboard navigation',
  'dashboard.mobileNav.home': 'Home',
  'dashboard.mobileNav.review': 'Review',
  'dashboard.mobileNav.resume': 'Continue',
  'dashboard.mobileNav.library': 'Library',
  'dashboard.mobileNav.settings': 'Settings',
  'dashboard.desktopNav.aria': 'Workspace navigation',
  'dashboard.desktopNav.workspace': 'Workspace',
  'dashboard.desktopNav.stats': 'Stats',
  'dashboard.desktopNav.account': 'Account',
  'dashboard.desktopNav.managePlan': 'Manage plan',
  'dashboard.desktopNav.upgradePlan': 'Upgrade plan',
  'dashboard.desktopNav.switchToFree': 'Switch to Free',
  'dashboard.desktopNav.leaderboard': 'Leaderboard',

  // Streak day counts (hero chip + metrics card)
  'dashboard.streakDays.one': '{count} day',
  'dashboard.streakDays.other': '{count} days',

  // ReviewTodayCard
  'dashboard.review.memoryQueue': 'Memory queue',
  'dashboard.reviewToday': 'Review Today',
  'dashboard.review.due.one': '{count} word · about {minutes} minutes',
  'dashboard.review.due.other': '{count} words · about {minutes} minutes',
  'dashboard.review.caughtUp': 'You are caught up. Mark difficult words as Review while listening.',
  'dashboard.review.start': 'Start review',
  'dashboard.reminder.title': 'Daily reminder',
  'dashboard.reminder.timeAria': 'Daily reminder time',
  'dashboard.reminder.on': 'On',
  'dashboard.reminder.enable': 'Enable',
  'dashboard.reminder.next': 'Next reminder at {time}',
  'dashboard.reminder.hint': 'Get your due-word count at this time.',
  'dashboard.reminder.msg.off': 'Daily reminder turned off.',
  'dashboard.reminder.msg.needPwa':
    'Install the app in a notification-capable browser to use reminders.',
  'dashboard.reminder.msg.blocked': 'Notifications are blocked. Allow them in your browser settings.',
  'dashboard.reminder.msg.set': 'Daily reminder set for {time}.',

  // Next-due guidance (0-due state on ReviewTodayCard + review screens)
  'dashboard.review.nextDue.today': 'Next word comes due later today.',
  'dashboard.review.nextDue.tomorrow': 'Next word comes due tomorrow.',
  'dashboard.review.nextDue.days.one': 'Next word comes due in {count} day.',
  'dashboard.review.nextDue.days.other': 'Next word comes due in {count} days.',
  'dashboard.review.nextDue.date': 'Next word comes due {date}.',

  // MetricCards
  'dashboard.metric.accuracy.label': 'Listening Accuracy',
  'dashboard.metric.accuracy.hint': 'Mastered vs. review words',
  'dashboard.metric.mastered.label': 'Words Mastered',
  'dashboard.metric.mastered.hint': 'Known across all sets',
  'dashboard.metric.streak.label': 'Study Streak',
  'dashboard.metric.streak.hint': '{days}-day habit target',

  // CloudSyncBadge
  'dashboard.sync.title': 'Sync this library across your signed-in devices',

  // AiInsightsCard
  'dashboard.insights.title': 'AI Insights',
  'dashboard.insights.subtitle': 'Smart recommendations for today',
  'dashboard.insights.goalLabel': 'Daily audio goal',
  'dashboard.insights.review.some.one': '{count} word needs review today',
  'dashboard.insights.review.some.other': '{count} words need review today',
  'dashboard.insights.review.none': 'All caught up — nothing needs review',
  'dashboard.insights.review.meta.some': 'Tap review mode in the player',
  'dashboard.insights.review.meta.none': 'Nice work!',
  'dashboard.insights.goal.done': 'Daily audio goal complete',
  'dashboard.insights.goal.progress': 'Daily audio goal {pct}% complete',
  'dashboard.insights.goal.meta.done': 'Fantastic focus 🎉',
  'dashboard.insights.goal.meta.left': '{pct}% to go — keep listening',
  'dashboard.insights.streak.some': '{days}-day streak — keep it alive',
  'dashboard.insights.streak.none': 'Start a streak today',
  'dashboard.insights.streak.meta.some': 'Consistency beats intensity',
  'dashboard.insights.streak.meta.none': 'One short session is enough',

  // AiAssistantButton
  'dashboard.aiAssistant.open': 'Open AI assistant',

  // GettingStartedChecklist
  'dashboard.checklist.kicker': 'Quick start',
  'dashboard.checklist.title': 'Get ready for your first listening loop',
  'dashboard.checklist.progress': '{done} of {total} steps complete',
  'dashboard.checklist.dismissAria': 'Dismiss getting started checklist',
  'dashboard.checklist.language.label': 'Choose your language',
  'dashboard.checklist.language.action': 'Choose',
  'dashboard.checklist.sets.label': 'Add a practice set',
  'dashboard.checklist.sets.action': 'Browse sets',
  'dashboard.checklist.practice.label': 'Play your first loop',
  'dashboard.checklist.practice.action': 'Start practice',

  // FreePlanNotice
  'dashboard.freeNotice.prefix': 'Your',
  'dashboard.freeNotice.includes.one': 'plan includes {limit} language — ',
  'dashboard.freeNotice.includes.other': 'plan includes {limit} languages — ',
  'dashboard.freeNotice.more.one': '1 more language is ready to unlock.',
  'dashboard.freeNotice.more.other': '{count} more languages are ready to unlock.',
  'dashboard.freeNotice.total': '{count} total.',
  'dashboard.freeNotice.upgrade': 'Upgrade to unlock',
  'dashboard.freeNotice.dismissAria': 'Dismiss upgrade notice',

  // ProFeatureLock (shared lock screen for Pro-only routes)
  'dashboard.lock.badge': 'Pro feature',
  'dashboard.lock.cta': '⭐ Upgrade to Pro',
  'dashboard.lock.freeNote':
    'Free keeps listening drills, dictation and one language with standard voices.',
  'dashboard.lock.back': 'Back to practice',

  // PWA install extras (InstallPrompt / InstallAppButton)

  // PWA update prompt (UpdatePrompt — waiting service worker)

  // Error boundary extra
} as const;

export type DashboardKeys = keyof typeof dashboardEn;
