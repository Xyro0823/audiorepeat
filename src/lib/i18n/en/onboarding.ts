/**
 * English strings for the onboarding area (keys are the source of truth).
 * Covers OnboardingFlow, FreeLanguagePicker, ChangeFreeLanguageModal,
 * FreeLanguageBar and FirstSessionGuide.
 */
export const onboardingEn = {
  // OnboardingFlow shell
  'onboarding.aria.title': 'Welcome to AudioRepeat',
  'onboarding.step.count': 'Step {step} of {total}',
  'onboarding.step.title.language': 'Choose language',
  'onboarding.step.title.level': 'Choose starting level',
  'onboarding.step.title.goal': 'Choose learning goal',
  'onboarding.step.title.ready': "You're all set",

  // Step 2 — starting level
  'onboarding.level.heading': 'Choose your starting level',
  'onboarding.level.sub':
    "We'll seed your library with words that fit — you can change it anytime.",
  'onboarding.level.groupAria': 'Starting level',
  'onboarding.level.testTitle': 'Quick starting-point check',
  'onboarding.level.testBody': 'Answer 10 short vocabulary questions for a helpful place to begin — not a formal CEFR exam.',
  'onboarding.level.startTest': 'Check my starting point',
  'onboarding.level.manualTitle': 'Or choose it yourself',
  'onboarding.level.selfAssessment': 'This language does not have enough level-specific words yet. Choose the level that feels closest — you can change it anytime.',
  'onboarding.placement.loading': 'Preparing your questions…',
  'onboarding.placement.questionCount': 'Question {current} of {total}',
  'onboarding.placement.prompt': 'Choose the matching word',
  'onboarding.placement.answersAria': 'Answer choices',
  'onboarding.placement.resultKicker': 'Recommended starting level',
  'onboarding.placement.resultBody': 'You answered {score} of {total} correctly. This is a starting suggestion, and you can change it anytime.',
  'onboarding.placement.note': 'This quick check uses vocabulary only. Your level will feel more accurate after a few real practice sessions.',
  'onboarding.placement.useLevel': 'Start at {level}',
  'onboarding.placement.chooseManually': 'Choose a different level',

  // Step 3 — learning goal
  'onboarding.goal.heading': 'What brings you here?',
  'onboarding.goal.sub': "Pick a learning goal — we'll use it to tailor your practice.",
  'onboarding.goal.groupAria': 'Learning goal',

  // Shared controls
  'onboarding.back': '← Back',

  // Step 4 — ready
  'onboarding.ready.heading': "You're all set!",
  'onboarding.ready.planIntro': "Here's your practice plan:",
  'onboarding.summary.language': 'Language',
  'onboarding.summary.startingLevel': 'Starting level',
  'onboarding.summary.goal': 'Goal',
  'onboarding.ready.recommended': 'Recommended first session',
  'onboarding.ready.startPractice': 'Start recommended practice',
  'onboarding.ready.goDashboard': 'Go to dashboard',

  // FreeLanguagePicker
  'onboarding.freeLang.title': 'Choose your free language',
  'onboarding.freeLang.subtitlePro':
    'Your plan includes every language — pick the one you want to focus on.',
  'onboarding.freeLang.subtitleFree':
    'Your Free plan includes {limit} language. Choose the language you want to practice.',
  'onboarding.freeLang.included': '✓ Included with Free',
  'onboarding.freeLang.locked': '🔒 Pro',
  'onboarding.freeLang.preferred': '✓ Preferred',
  'onboarding.freeLang.fullPack': 'Full A1–C2 pack',
  'onboarding.freeLang.starterPack': 'Starter pack',
  'onboarding.freeLang.voiceChecking': 'Checking device voice…',
  'onboarding.freeLang.voiceReady': 'Device voice ready',
  'onboarding.freeLang.voiceUnavailable': 'No matching device voice found',
  'onboarding.freeLang.voiceUnavailableHint': 'You can still continue. AudioRepeat will ask your browser to use its best available voice.',

  // ChangeFreeLanguageModal
  'onboarding.changeLang.aria': 'Change your free language',
  'onboarding.changeLang.title': 'Change your free language',
  'onboarding.changeLang.body':
    "Sets in your current language stay saved — they'll be hidden, not deleted, and come back if you upgrade.",
  'onboarding.changeLang.pickerSubtitle.one':
    "Your Free plan includes {limit} language. Pick the one you want to practice — switching hides your other sets (they're kept, never deleted).",
  'onboarding.changeLang.pickerSubtitle.other':
    "Your Free plan includes {limit} languages. Pick the one you want to practice — switching hides your other sets (they're kept, never deleted).",
  'onboarding.changeLang.settingUp': 'Setting up your language…',

  // FreeLanguageBar
  'onboarding.bar.your': 'Your',
  'onboarding.bar.freeLanguage': 'free language',
  'onboarding.bar.change': 'Change',

  // FirstSessionGuide
  'onboarding.guide.firstLoop': 'First loop',
  'onboarding.guide.stepProgress': 'Step {current} of {total}',
  'onboarding.guide.skipAria': 'Skip first-session guide',
  'onboarding.guide.skipTitle': 'Skip guide',
  'onboarding.guide.gotIt': 'Got it',
  'onboarding.guide.step1.eyebrow': 'Listen',
  'onboarding.guide.step1.title': 'Let the loop do the work',
  'onboarding.guide.step1.description':
    'Press Play once. AudioRepeat cycles through the target word and translation, then moves forward hands-free.',
  'onboarding.guide.step2.eyebrow': 'Decide',
  'onboarding.guide.step2.title': 'Teach the app what needs work',
  'onboarding.guide.step2.description':
    'Use Known when recall feels easy. Use Review when a word needs another pass—this keeps your daily queue useful.',
  'onboarding.guide.known': 'Known',
  'onboarding.guide.reviewSooner': 'Review sooner',
  'onboarding.guide.step3.eyebrow': 'Return',
  'onboarding.guide.step3.title': 'Come back to Review Today',
  'onboarding.guide.step3.description':
    'Your difficult words reappear when they are most useful to practise. A short daily session is enough to keep momentum.',
  'onboarding.guide.nextSmartReview': 'Next smart review',
  'onboarding.guide.reviewToday': 'Review Today',
} as const;

export type OnboardingKeys = keyof typeof onboardingEn;
