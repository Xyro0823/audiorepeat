/**
 * English strings for the Settings modal (keys are the source of truth).
 */
export const settingsEn = {
  'settings.title': '⚙️ Settings',
  'settings.aria.label': 'Settings',
  'settings.close.aria': 'Close settings',
  'settings.tab.language': '🌐 Language',
  'settings.tab.playback': '🎛️ Playback',
  'settings.tab.appearance': '🎨 Appearance',
  'settings.tab.data': '💾 Data',
  'settings.tab.reminders': '🔔 Reminders',

  // Interface language (UI localization — separate from learning languages)
  'settings.uiLang.title': 'Interface language',
  'settings.uiLang.hint':
    'Menus, buttons and messages only. The languages you learn are not affected.',

  // Learning-language section
  'settings.practice.lang': 'Practice language',
  'settings.pro.lang.line':
    'Pro plan — you can create sets in all {count} supported languages.',
  'settings.free.lang.line':
    'The Free plan includes {limit} active language. Upgrade to access all {count}.',
  'settings.default.new.set.lang': 'Default new-set language',
  'settings.auto.set.lang': 'Auto — language of the set',
  'settings.full.pack.suffix': ' · full CEFR pack',
  'settings.default.set.lang.hint':
    'Sets you create will default to this language. You can always change it per set.',
  'settings.not.selected.yet': 'Not selected yet',
  'settings.current': 'Current',
  'settings.change.language': 'Change language',
  'settings.upgrade.all.languages': '⭐ Upgrade to unlock all {count} languages',
  'settings.switching.hint':
    'Switching hides your other languages — they come back if you upgrade. Nothing is ever deleted.',
  'settings.voice.availability': 'Voice availability',
  'settings.voice.availability.body':
    'Device voices play instantly. When a voice is missing, secure cloud speech can generate it once and save it for offline replay.',
  'settings.cloud.voices.toggle': 'Use secure cloud voices',
  'settings.cloud.voices.hint':
    'Sends only the word being spoken to Microsoft Azure, then caches the audio on this device',
  'settings.pro.cloud.title': '⭐ Cloud voices & offline audio packs are part of Pro',
  'settings.pro.cloud.body':
    'The Free plan uses the standard voices installed on this device. Pro can generate any missing voice in the cloud and cache it for offline replay.',
  'settings.upgrade.to.pro': 'Upgrade to Pro',
  'settings.cloud.not.configured': 'Cloud voices are not configured on this server yet.',
  'settings.loading.voices': 'Loading voices…',
  'settings.voice.legend':
    'Green = installed on this device. Cyan = secure cloud voice with offline cache.',
  'settings.voice.legend.gray': ' Gray = cloud speech is not configured yet.',

  // Playback
  'settings.repeat.each.word': 'Repeat each word',
  'settings.repeat.hint': 'The translation is always spoken once after the repeats.',
  'settings.default.speed': 'Default playback speed',
  'settings.speed.hint':
    'The player bar also offers a fine-grained 0.5×–2× slider for the current session.',
  'settings.pause.before.translation': 'Pause before translation',
  'settings.target.voice.label': 'Default target voice ({lang})',
  'settings.translation.voice.label': 'Default translation voice',
  'settings.voices.override.hint':
    'Voices apply to every set unless a set has its own overrides (Loop settings → “Customize settings for this set”).',

  // Appearance
  'settings.theme': 'Theme',
  'settings.theme.neon.label': 'Dark Glass',
  'settings.theme.neon.desc': 'Deep charcoal mesh with blue accents',
  'settings.theme.dark.label': 'Dark Mode',
  'settings.theme.dark.desc': 'Muted charcoal, calmer standard accents',
  'settings.theme.light.label': 'Minimal Light',
  'settings.theme.light.desc': 'Light surfaces with dark slate text',
  'settings.hints.toggle': 'Emoji & visual hints on word cards',
  'settings.hints.hint': 'A contextual emoji for each word — works offline',
  'settings.examples.toggle': 'Example sentences',
  'settings.examples.hint': "Show a word's example sentence when it has one",
  'settings.cloud.speech.on':
    'Cloud speech is enabled for missing device voices. Generated audio is cached for offline replay.',
  'settings.cloud.speech.available.off':
    'Cloud speech is available but off. Enable it in the Language tab to use missing voices.',
  'settings.cloud.speech.pro.only':
    'Cloud voices and offline audio packs are a Pro feature — the Free plan uses your device voices.',
  'settings.cloud.speech.unconfigured':
    'Cloud speech is not configured yet, so playback currently uses device voices.',

  // Data
  'settings.account': 'Account',
  'settings.account.signed.in':
    'Signed in with Firebase as {who}. Your identity syncs online; stats, streak and sets stay on this device.',
  'settings.account.guest':
    'You are using the app as a guest. Sign in with Google or an email account from the header.',
  'settings.account.unconfigured':
    "Firebase isn't configured yet — add your config to .env.local (see .env.example) to enable sign-in. Until then, the app runs in guest mode.",
  'settings.view.plans': 'View plans',
  'settings.upgrade': 'Upgrade',
  'settings.switch.to.free': 'Switch to Free',
  'settings.backup.title': 'Backup & restore',
  'settings.backup.body':
    'Export your sets, settings, stats and display name as a single JSON file, and restore them on any device.',
  'settings.export.backup': '⬇ Export backup',
  'settings.import.backup': '⬆ Import backup',
  'settings.cache.title': 'Cache',
  'settings.cache.body':
    'Older locally cached speech clips can be removed here. New clips are not generated while offline speech generation is disabled.',
  'settings.clear.cached.audio': '🗑 Clear cached audio',
  'settings.reset.progress.title': 'Reset study progress',
  'settings.reset.progress.body':
    'Clears your streak, daily stats and word-mastery marks. Your sets are kept.',
  'settings.reset.progress.confirm': 'Yes, reset everything',
  'settings.reset.progress.button': 'Reset progress…',

  // Flash messages
  'settings.flash.backup.downloaded': 'Backup downloaded — keep it somewhere safe.',
  'settings.flash.invalid.backup': 'That file is not a valid AudioRepeat backup.',
  'settings.flash.read.failed': 'Could not read that backup file.',
  'settings.flash.restored': 'Backup restored — reloading…',
  'settings.flash.restore.failed': 'Restore failed — reload the app and check your data.',
  'settings.flash.clear.cache.failed': 'Could not clear the audio cache.',
  'settings.flash.cache.cleared': 'Cleared {count} cached audio clip(s).',
  'settings.flash.no.cached.audio': 'No cached audio found.',
  'settings.flash.reset.failed': 'Reset failed.',
  'settings.flash.notifications.unsupported':
    'Notifications are not supported in this browser.',
  'settings.flash.permission.denied':
    'Permission denied — enable notifications in your browser settings.',
  'settings.flash.reminders.need.pwa':
    'Reminders need the installed PWA (production build) — not available in dev.',
  'settings.flash.test.sent': 'Test notification sent (check your notification center).',
  'settings.flash.test.failed': 'Could not reach the installed app notification service.',

  // Restore confirmation overlay
  'settings.restore.question': 'Restore backup?',
  'settings.restore.body':
    'This replaces your current library, settings, stats and display name with the backup ({count} sets).',
  'settings.restore.button': 'Restore',

  // Reminders
  'settings.reminders.unsupported.body':
    'Daily reminders need the Service Worker + Notification API. They work when the app is installed as a PWA (production build) — not in the dev preview.',
  'settings.daily.reminder.toggle': 'Daily practice reminder',
  'settings.daily.reminder.hint':
    'A notification reminds you to practice at the chosen time',
  'settings.remind.me.at': 'Remind me at',
  'settings.send.test.notification': 'Send test notification',
  'settings.reminders.triggers.hint':
    'Uses the browser’s Notification Triggers API, so the reminder fires even when the app is closed (Chrome desktop & Android). The reminder re-arms whenever you open the app.',
  'settings.reminders.blocked.note':
    'Notifications are blocked in your browser settings. Unblock them to enable reminders.',
} as const;

export type SettingsKeys = keyof typeof settingsEn;
