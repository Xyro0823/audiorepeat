/**
 * English strings for the library area (keys are the source of truth).
 * Grouped by component: shared concepts live at the top and are reused.
 */
export const libraryEn = {
  // ---- Shared across the library area ----
  'library.wordsCount': '{count} words',
  'library.masteredPct': '{pct}% mastered',
  'library.pickLanguage': 'Pick a language',
  'library.preview': 'Preview',
  'library.typeToSearch': 'Start typing to search languages',
  'library.confirmDelete': 'Confirm delete',
  'library.keepWords': 'Keep words',
  'library.proFeature': 'Pro feature',

  // CEFR level names (the A1–C2 codes themselves are never translated)
  'library.cefr.A1': 'Beginner',
  'library.cefr.A2': 'Elementary',
  'library.cefr.B1': 'Intermediate',
  'library.cefr.B2': 'Upper-intermediate',
  'library.cefr.C1': 'Advanced',
  'library.cefr.C2': 'Proficiency',

  // ---- Top bar / new-set menu ----
  'library.newSet.title': 'Create a new set or import one',
  'library.newSet.newSet': 'New set',
  'library.newSet.importJson': 'Import (JSON)',
  'library.tagline': '{count} languages · hands-free practice',

  // ---- Transient flash messages ----
  'library.flash.invalidFile': 'That file is not a valid AudioRepeat set.',
  'library.flash.imported': 'Imported “{name}” ({count} words).',
  'library.flash.readFailed': 'Could not read that file.',
  'library.flash.readSubtitleFailed': 'Could not read that subtitle file.',
  'library.flash.badShareLink': 'That share link is invalid or corrupted.',
  'library.flash.starterFailed': 'Could not import that starter set.',

  // ---- Featured spotlight card ----
  'library.featured.editorsPick': 'Editor’s Pick',
  'library.featured.deviceSpeech': 'Device Speech Audio',
  'library.featured.ofDay': 'Featured set of the day',
  'library.featured.meta': '{target} → {native} · {count} words',
  'library.featured.metaCefr': ' · {level} {label}',
  'library.featured.body':
    'Loop, repeat, and retain {count} essential {lang} words with hands-free audio drilling — perfect for commutes, chores, and winding down.',
  'library.featured.knownCount': '{count} words known',
  'library.featured.startLearning': 'Start Learning',

  // ---- Library card + actions menu ----
  'library.card.actionsAria': 'Actions for {name}',
  'library.card.challenge': '1-Min challenge',
  'library.card.downloadJson': 'Download JSON',
  'library.card.copyShareLink': 'Copy share link',
  'library.card.customSettings': ' · custom settings',
  'library.card.toReview': '{count} to review',
  'library.card.quickTestTitle': 'Quick 1-minute speed test',
  'library.card.proTestTitle': 'Speed challenges are a Pro feature',
  'library.card.quickTest': 'Quick Test',
  'library.card.test': 'Test',

  // ---- Left sidebar ----
  'library.sidebar.featuredLanguages': 'Featured Languages',
  'library.sidebar.playAria': 'Play {name}',
  'library.sidebar.continuePractice': 'Continue Practice',
  'library.sidebar.playLast': 'Play Last Practice',
  'library.sidebar.recentsEmpty':
    'Practice any set and it will show up here so you can resume right where you left off.',
  'library.sidebar.today': 'Today',
  'library.sidebar.wordsListened': 'Words listened',
  'library.sidebar.studyTime': 'Study time',
  'library.sidebar.streak': 'Streak',
  'library.sidebar.streakDays': '🔥 {count} days',

  // ---- Sets grid ----
  'library.grid.title': 'Language Sets & Library',
  'library.grid.loading': 'Loading your sets…',
  'library.grid.filteredSummary':
    '{shown} of {total} sets · {words} words · {langs} languages',
  'library.grid.summary': '{sets} sets · {words} words · {langs} languages',
  'library.grid.searchPlaceholder': 'Search sets or languages…',
  'library.grid.searchAria': 'Search sets',
  'library.grid.filterCefrAria': 'Filter by CEFR level',
  'library.grid.filterLangAria': 'Filter by language',
  'library.grid.allLanguages': 'All languages',
  'library.grid.clearFilters': 'Clear filters',
  'library.grid.emptyTitle': 'No vocabulary sets yet',
  'library.grid.emptyBody':
    'Create your first set with the + New button, import a JSON set, or grab a starter pack from the library.',
  'library.grid.browseStarter': 'Browse starter library',
  'library.grid.noMatchTitle': 'No sets match your filters',
  'library.grid.noMatchBody': 'Try a different search, level, or language.',

  // ---- Browse-library modal (starter packs) ----
  'library.starter.title': 'Browse library',
  'library.starter.subtitleTopics':
    'Topic-based word packs for everyday situations — import one per language.',
  'library.starter.subtitleFull':
    'Comprehensive CEFR word packs in {langs} languages — {words} words total. Import a level or practice a batch.',
  'library.starter.subtitlePlain':
    'Comprehensive CEFR word packs — import a level or practice a batch.',
  'library.starter.tabCefr': 'CEFR levels',
  'library.starter.tabTopics': 'Topics',
  'library.starter.loadingLibrary': 'Loading the vocabulary library…',
  'library.starter.errorUnavailable':
    'The vocabulary library is not available yet — try again online.',
  'library.starter.errorLevel': 'Could not load this level.',
  'library.starter.optionMeta': ' · {count} words',
  'library.starter.chipCount': '{count} words',
  'library.starter.notYet': 'Not available yet',
  'library.starter.searchPlaceholder': 'Search {lang} words…',
  'library.starter.batch': 'Batch',
  'library.starter.pickLangBody': 'Pick a language to browse its word packs.',
  'library.starter.pickLevelBody': 'Pick a level to see its words.',
  'library.starter.levelsHint':
    'Each level is a full study deck — A1/A2 ≈ 200–300 words, B1/B2 ≈ 500, C1/C2 ≈ 1,000.',
  'library.starter.loadingLevel': 'Loading {count} words…',
  'library.starter.matches': 'matches',
  'library.starter.wordsInLevel': 'words in this level',
  'library.starter.ofTotal': 'of {count}',
  'library.starter.practiceBatch': '▶ Practice batch of {count}',
  'library.starter.playAllTitle': 'Import the whole level as one set — play all words',
  'library.starter.playAll': '⬇ Play all',
  'library.starter.playAllCount': '({count})',
  'library.starter.previewHeader': 'Preview — {count} words (scroll to browse)',
  'library.starter.noMatch': 'No words match “{query}”.',
  'library.starter.progressLevels': '{imported} of {available} levels imported',
  'library.starter.progressWords': ' · {count} words',

  // ---- Topics tab (inside the browse-library modal) ----
  'library.topics.errorUnavailable': 'Topics are not available yet — try again online.',
  'library.topics.errorLoad': 'Could not load this topic.',
  'library.topics.loadingTopics': 'Loading topics…',
  'library.topics.cardMeta': '{words} words · {langs} languages',
  'library.topics.loadingWords': 'Loading words…',
  'library.topics.importTopic': 'Import topic',
  'library.topics.noWords': 'No words available for this language yet.',

  // ---- Set editor ----
  'library.editor.editTitle': 'Edit set',
  'library.editor.newTitle': 'New vocabulary set',
  'library.editor.setName': 'Set name',
  'library.editor.namePlaceholder': 'e.g. German Basics',
  'library.editor.targetLanguage': 'Target language',
  'library.editor.targetPlaceholder': 'e.g. es-ES or German (Germany)',
  'library.editor.speakingHint': 'Speaking: {lang}',
  'library.editor.nativeLanguage': 'Native language',
  'library.editor.nativePlaceholder': 'e.g. en-US',
  'library.editor.translationsHint': 'Translations in: {lang}',
  'library.editor.cefrLabel': 'CEFR level (optional)',
  'library.editor.noLevel': 'No level',
  'library.editor.selectAll': 'Select all words',
  'library.editor.deselectAll': 'Deselect all words',
  'library.editor.wordsCount': 'Words ({count})',
  'library.editor.repeatsHint': 'repeats: 1×–5× per word, then the translation once',
  'library.editor.selectedCount': '{count} selected',
  'library.editor.targetInputPlaceholder': 'Target (gracias)',
  'library.editor.translationInputPlaceholder': 'Translation (thank you)',
  'library.editor.examplePlaceholder': 'Example sentence (optional) — e.g. “{word}” in context',
  'library.editor.targetAria': 'Target word {n}',
  'library.editor.translationAria': 'Translation {n}',
  'library.editor.exampleAria': 'Example sentence {n}',
  'library.editor.useDefaultRepeats': 'Use the global default instead',
  'library.editor.repeatsN': '{count} repeats',
  'library.editor.addWord': '+ Add word',
  'library.editor.saveError': 'Could not save this set. Your changes are still here — please try again.',
  'library.editor.savePlay': 'Save & play',
  'library.editor.createPlay': 'Create & play',

  // ---- Bulk word actions (in the editor) ----
  'library.bulk.actionsAria': 'Bulk word actions',
  'library.bulk.known': 'Known',
  'library.bulk.review': 'Review',
  'library.bulk.reset': 'Reset',
  'library.bulk.markedKnown': '{count} words marked Known.',
  'library.bulk.markedReview': '{count} words marked Review.',
  'library.bulk.markedReset': '{count} words marked Learning.',
  'library.bulk.deleteQuestion': 'Delete {count} words?',
  'library.bulk.draftNote': 'This only changes the current draft. It takes effect when you save the set.',
  'library.bulk.deletedFromDraft': '{count} words deleted from this draft.',
  'library.bulk.selectWord': 'Select {name}',
  'library.bulk.wordNumber': 'word {n}',
  'library.bulk.deleteWord': 'Delete {name}',
  'library.bulk.repeatsAria': 'Repeats for word {n}',

  // ---- Free-plan language lock banner ----
  'library.lock.bodyOne': 'This language needs Pro — your Free plan includes {count} language.',
  'library.lock.bodyMany': 'This language needs Pro — your Free plan includes {count} languages.',
  'library.lock.upgrade': 'Upgrade to Pro',

  // ---- Share set modal ----
  'library.share.set': 'Share set',
  'library.share.privacyLine': '{count} words · progress and review history stay private',
  'library.share.closeAria': 'Close share dialog',
  'library.share.qrAlt': 'QR code for {name}',
  'library.share.qrTooLarge': 'This set is too large for a QR code. Use the share link instead.',
  'library.share.scanToImport': 'Scan to import',
  'library.share.recipientBody': 'The recipient imports a fresh copy into their own library.',
  'library.share.nativeText': 'Practice “{name}” in AudioRepeat',
  'library.share.promptCopy': 'Copy this share link:',
  'library.share.linkCopied': '✓ Link copied',
  'library.share.copyLink': 'Copy link',
  'library.share.downloadQr': 'Download QR image',

  // ---- Shared-set import preview modal ----
  'library.importPreview.eyebrow': 'Shared set preview',
  'library.importPreview.description': 'Check the set before adding a fresh copy to your library.',
  'library.importPreview.closeAria': 'Close import preview',
  'library.importPreview.detailsAria': 'Set details',
  'library.importPreview.learn': 'Learn',
  'library.importPreview.translation': 'Translation',
  'library.importPreview.cefrLevel': '{level} level',
  'library.importPreview.sampleWords': 'Sample words',
  'library.importPreview.previewOnly': 'Preview only',
  'library.importPreview.moreWords': '+ {count} more words',
  'library.importPreview.privacyNote':
    'Only the words and playback settings are included. The sender’s Known, Review, and study history stay private.',
  'library.importPreview.duplicateTitle': 'Already in your library',
  'library.importPreview.duplicateBody':
    '“{name}” has the same languages and word content, so no duplicate will be created.',
  'library.importPreview.importError': 'This set could not be imported. Your library was not changed.',
  'library.importPreview.importing': 'Importing…',
  'library.importPreview.importSet': 'Import set',

  // ---- Subtitle import modal ----
  'library.subtitles.title': '🎬 Import subtitles',
  'library.subtitles.keywords': 'keywords',
  'library.subtitles.tokens': 'word tokens',
  'library.subtitles.dialogLines': 'dialog lines',
  'library.subtitles.languageLabel': 'Subtitle language',
  'library.subtitles.langPlaceholder': 'e.g. es-ES',
  'library.subtitles.hintPack': '{lang} — translations matched offline from the bundled word bank',
  'library.subtitles.hintNoPack': '{lang} — no bundled dictionary; every translation will need filling in',
  'library.subtitles.mostFrequent': 'Most frequent',
  'library.subtitles.showMore': 'Show more',
  'library.subtitles.noKeywords': 'No usable keywords found — is this a subtitle file?',
  'library.subtitles.matching': 'Matching translations…',
  'library.subtitles.createSet': 'Create set ({count} words)',
  'library.subtitles.footnote':
    'Words without an offline match are marked “—”. The set opens in the editor so you can review and fill them in before saving.',

  // ---- Daily leaderboard modal ----
  'library.leaderboard.title': '🏆 Daily Leaderboard',
  'library.leaderboard.closeAria': 'Close leaderboard',
  'library.leaderboard.todayStats': '🔥 {streak}-day streak · {words} words · {time} today',
  'library.leaderboard.rankBadge': 'Rank #1',
  'library.leaderboard.accountNamePrefix': 'Your account name',
  'library.leaderboard.accountNameSuffix': 'is your leaderboard name.',
  'library.leaderboard.displayName': 'Display name',
  'library.leaderboard.savedCheck': 'Saved ✓',
  'library.leaderboard.todayByLanguage': 'Today by language',
  'library.leaderboard.emptyTitle': 'No practice yet today',
  'library.leaderboard.emptyBody': 'Press play on a set to start climbing the board.',
  'library.leaderboard.rowWords': '{count} words',
  'library.leaderboard.footerNote':
    'AudioRepeat is offline-first with no server, so this board ranks your own daily practice by language. The layout is ready for a friends/global feed if a backend is ever added.',
} as const;

export type LibraryKeys = keyof typeof libraryEn;
