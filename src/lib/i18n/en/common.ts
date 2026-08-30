/**
 * English dictionary — the source of truth for translation keys.
 * Every other locale file must implement `Record<keyof ThisFile, string>`,
 * so a missing Mongolian key is a COMPILE error, not a runtime gap.
 *
 * Conventions:
 *  - Keys are flat and namespaced by area: 'area.context.meaning'.
 *  - Interpolation uses {name} placeholders; both locales must keep them.
 *  - Never translate the brand name "AudioRepeat".
 */
export const commonEn = {
  'common.save': 'Save',
  'common.saved': 'Saved',
  'common.saving': 'Saving…',
  'common.cancel': 'Cancel',
  'common.close': 'Close',
  'common.delete': 'Delete',
  'common.edit': 'Edit',
  'common.done': 'Done',
  'common.back': 'Back',
  'common.next': 'Next',
  'common.previous': 'Previous',
  'common.start': 'Start',
  'common.retry': 'Try again',
  'common.continue': 'Continue',
  'common.confirm': 'Confirm',
  'common.yes': 'Yes',
  'common.no': 'No',
  'common.loading': 'Loading…',
  'common.search': 'Search',
  'common.copy': 'Copy',
  'common.copied': 'Copied!',
  'common.download': 'Download',
  'common.open': 'Open',
  'common.play': 'Play',
  'common.pause': 'Pause',
  'common.stop': 'Stop',
  'common.replay': 'Replay',
  'common.error': 'Something went wrong. Please try again.',
  'common.networkError': 'You appear to be offline. Check your connection and try again.',
  'common.required': 'Required',
  'common.optional': 'Optional',
  'common.new': 'New',
  'common.pro': 'Pro',
  'common.free': 'Free',
  'common.guest': 'Guest',
  'common.account': 'Account',
  'common.language': 'Language',
  'common.words': 'words',
  'common.word': 'word',
  'common.minutes': 'min',
  'common.today': 'Today',
  'common.all': 'All',
  'common.none': 'None',
  'common.name': 'Name',
  'common.email': 'Email',
  'common.password': 'Password',
  'common.skipToMainContent': 'Skip to main content',
} as const;
export type CommonKeys = keyof typeof commonEn;

/** Install / PWA prompts and generic app-shell copy. */
export const pwaEn = {
  'pwa.install.title': 'Install AudioRepeat',
  'pwa.install.body': 'Add AudioRepeat to your home screen for full-screen practice and offline audio.',
  'pwa.install.button': 'Install app',
  'pwa.install.later': 'Not now',
  'pwa.install.ios': 'Tap the Share button, then “Add to Home Screen”.',
  'pwa.installed': 'App installed',
  // PWA install surface lives in the root layout — keys kept in core so any
  // route can render the prompt without the dashboard namespace.
  'dashboard.install.addTitle': 'Add to Home Screen',
  'dashboard.install.dismissAria': 'Dismiss',
  'dashboard.install.menuPrefix': 'Open your browser menu and choose',
  'dashboard.install.or': 'or',
  // Global update toast (root layout) - must resolve on ANY route.
  'dashboard.update.title': 'Update available',
  'dashboard.update.body': 'A new version of AudioRepeat is ready.',
  'dashboard.update.reload': 'Update now',
  'dashboard.update.dismissAria': 'Dismiss update notice',
} as const;
export type PwaKeys = keyof typeof pwaEn;

/** Generic sync-state copy (detailed states live with their components). */
export const syncEn = {
  'sync.state.idle': 'Cloud sync ready',
  'sync.state.syncing': 'Syncing…',
  'sync.state.synced': 'Synced',
  'sync.state.offline': 'Offline — changes are saved locally',
  'sync.state.rateLimited': 'Sync paused briefly — retrying automatically',
  'sync.state.error': 'Sync problem — retrying soon',
  'sync.lastSynced': 'Last synced {time}',
} as const;
export type SyncKeys = keyof typeof syncEn;

/** Shared error / empty-state copy used across areas. */
export const errorsEn = {
  'error.generic.title': 'Something went wrong',
  'error.generic.body': 'An unexpected error occurred. Your data is safe — try again.',
  'error.empty.sets.title': 'No sets yet',
  'error.empty.sets.body': 'Create your first set or pick one from the library to begin.',
  'error.empty.words.title': 'No words in this set',
  'error.empty.words.body': 'Add words to start practicing.',
  'error.offline.title': 'You are offline',
  'error.offline.body': 'Practice still works — changes sync when you reconnect.',
  // Global error boundary lives on every route — key kept in core.
  'dashboard.error.dashboardLink': 'Dashboard',
} as const;
export type ErrorKeys = keyof typeof errorsEn;

export const en = { ...commonEn, ...pwaEn, ...syncEn, ...errorsEn };
