/** English strings for the player area (keys are the source of truth). */
export const playerEn = {
  // Global player states
  'player.state.loading': 'Loading…',
  'player.state.setNotFound': 'Set not found',
  'player.state.setNotFoundBody': 'It may have been deleted.',
  'player.state.backToLibrary': 'Back to library',

  // Header
  'player.header.library': 'Library',
  'player.header.libraryAria': 'Back to library',
  'player.header.wordsAll': '{count} words',
  'player.header.wordsFiltered': '{shown} / {total} words',

  // Filter / mode row
  'player.filter.all': 'All',
  'player.filter.learning': 'Learning',
  'player.filter.review': 'Review',
  'player.filter.hintLearning': 'only words not yet mastered',
  'player.filter.hintHard': 'only words marked for review',
  'player.filter.reviewProTitle': 'Spaced-repetition filters are a Pro feature',
  'player.filter.reviewProLabel': 'Review · Pro',
  'player.filter.freeLangTitle':
    'The Free plan includes {limit} active language — upgrade to unlock all languages',
  'player.filter.freeLangLabel': 'Free · {limit} language',
  'player.filter.quiz': 'Quiz',
  'player.filter.quizEmpty': 'No words to quiz on with this filter',
  'player.filter.quizHow': 'Hear a word, then pick its translation from four choices',
  'player.filter.quizProTitle': 'Quiz mode is a Pro feature',
  'player.filter.dictation': 'Dictation',
  'player.filter.dictationEmpty': 'No words to dictate with this filter',
  'player.filter.dictationHow':
    'Hear a word with its spelling hidden, then type what you hear',
  'player.filter.sleepCancelTitle': 'Sleep timer active — tap to cancel',
  'player.filter.snoozeTitle':
    'Tap Play within 30s to restart the timer, or tap here to dismiss',
  'player.filter.snoozeLabel': '⏰ Snooze {time}',

  // Filtered-to-empty state
  'player.empty.title': 'All caught up! 🎉',
  'player.empty.hardBody':
    'No words are marked for review. While drilling, tap Review on words you want to revisit.',
  'player.empty.masteredBody': 'Every word in this set is mastered.',
  'player.empty.playAll': 'Play all {count} words',

  // Free daily limit banner
  'player.limit.title': 'Daily Free limit reached',
  'player.limit.body':
    'The Free plan includes {limit} words a day. Your allowance resets at midnight — or practice without limits with Pro.',
  'player.limit.upgrade': 'Upgrade to Pro',

  // Resume card
  'player.resume.heading': 'Continue listening',
  'player.resume.wordLine': 'Word {index} · {word}',
  'player.resume.startOver': 'Start over',
  'player.resume.cta': '▶ Resume',

  // Cloud voice consent
  'player.cloudVoice.title': 'Hear this language clearly',
  'player.cloudVoice.body':
    'This device has no compatible voice. AudioRepeat can securely send only the word being spoken to Microsoft Azure, then save the audio on this device.',
  'player.cloudVoice.enable': 'Enable cloud voice',
  'player.cloudVoice.signInEnable': 'Sign in & enable cloud voice',
  'player.cloudVoice.footer': 'You can turn it off anytime in Settings.',

  // Toasts
  'player.toast.cloudEnabled': 'Cloud voice enabled. Audio will be saved for faster replay.',
  'player.toast.enableCloudVoice': 'Enable cloud voice below to hear this language clearly.',
  'player.toast.enableCloudForQuiz': 'Enable cloud voice below before starting the quiz.',
  'player.toast.enableCloudForDictation':
    'Enable cloud voice below before starting dictation.',
  'player.toast.sleepEnded': '🌙 Sleep timer ended — tap Play within 30s to snooze.',
  'player.toast.freeLimit':
    'Free plan includes {limit} words a day — upgrade to Pro for unlimited practice.',

  // WordCard
  'player.card.readyTitle': 'Ready when you are',
  'player.card.readyBody':
    'Press play to hear each word repeated in your target language, then its translation.',
  'player.card.targetPos': 'Target · {index} / {total}',
  'player.card.translationPos': 'Translation · {index} / {total}',
  'player.card.noVoiceTitle':
    'No speech voice is installed for this language on your device — audio may be silent or use the wrong language. Pick a voice in Settings.',
  'player.card.noVoice': 'No voice for this language',
  'player.card.cloudVoiceTitle':
    'No device voice is installed for this language, so AudioRepeat is using its secure cloud voice and saving the result for offline replay.',
  'player.card.cloudVoice': 'Cloud voice · cached after first play',
  'player.card.repeatN': 'repeat {current} / {total}',
  'player.badge.mastered': 'mastered',
  'player.badge.review': 'review',
  'player.mastery.unmark': 'Unmark this word',
  'player.mastery.markKnown': 'Mark as known',
  'player.mastery.known': 'Known',
  'player.mastery.markReview': 'Mark for review',
  'player.mastery.review': 'Review',
  'player.mastery.proTitle': 'Marking words as known / review is a Pro feature',
  'player.mastery.proCta': 'Track mastery — Pro',

  // Shared badges & hints
  'player.hint.emoji': 'Emoji hint',
  'player.scoreBadge': '{correct}/{total} correct',
  'player.playAgain': '▶ Play again',

  // PlayerControls
  'player.controls.prevAria': 'Go to previous word',
  'player.controls.replayAria': 'Replay current word',
  'player.controls.prevTitle': 'Previous word',
  'player.controls.play': 'Play',
  'player.controls.pause': 'Pause',
  'player.controls.nextWord': 'Skip to next word',
  'player.controls.stop': 'Stop',
  'player.controls.speedAria': 'Playback speed {speed}×',
  'player.controls.speedTitle': 'Playback speed — tap to change',
  'player.controls.shuffleOn': 'Shuffle on — tap to turn off',
  'player.controls.shuffleOff': 'Shuffle off — tap to randomize the word order',

  // SettingsPanel
  'player.settings.title': 'Loop settings',
  'player.settings.thisSet': 'this set',
  'player.settings.customizeSet': 'Customize settings for this set',
  'player.settings.customHintOn': 'Changes below apply only to this set',
  'player.settings.customHintOff': 'Changes below apply to all sets',
  'player.settings.repeats': 'Repeats per word',
  'player.settings.repeatHint': 'The translation is always spoken once after the repeats.',
  'player.settings.speed': 'Speed',
  'player.settings.gapBefore': 'Pause before translation',
  'player.settings.gapAfter': 'Pause after translation',
  'player.settings.loopList': 'Loop the whole list',
  'player.settings.cloudOn':
    'Missing device voices use secure cloud speech and are cached for offline replay.',
  'player.settings.cloudAvailableOff':
    'Cloud speech is available but off. Enable it in Settings → Language.',
  'player.settings.cloudUnconfigured':
    'Cloud speech is not configured yet; device speech is used instead.',
  'player.settings.showHints': 'Show emoji hints on word cards',
  'player.settings.showHintsHint': 'A contextual emoji for each word — works offline',
  'player.settings.sleepTimer': 'Sleep timer',
  'player.settings.sleepOff': 'Off',
  'player.settings.sleepPlaceholder': 'Custom',
  'player.settings.sleepInputAria': 'Custom sleep timer minutes',
  'player.settings.sleepActive':
    '🌙 Stops in {time} — volume fades out during the last 15 seconds.',
  'player.settings.sleepHint':
    'Volume fades out smoothly over the last 15 seconds, then playback stops.',
  'player.settings.targetVoice': 'Target voice ({lang})',
  'player.settings.translationVoice': 'Translation voice ({lang})',

  // QuizCard
  'player.quiz.completeTitle': 'Quiz complete!',
  'player.quiz.allSkippedBody':
    'All {count} questions were skipped. Try answering next time — you get instant feedback on every word.',
  'player.quiz.pctCorrect': '{pct}% correct',
  'player.quiz.modeTitle': 'Quiz mode',
  'player.quiz.modeIntro':
    'Press play to hear a word, then pick its translation from the choices.',
  'player.quiz.questionN': 'Question {current} / {total}',
  'player.quiz.pickTranslation': 'Pick the translation',
  'player.quiz.correct': 'Correct! ✓',
  'player.quiz.itWas': '✗ It was "{answer}"',
  'player.quiz.replayWord': 'Replay word',

  // DictationCard
  'player.dictation.completeTitle': 'Dictation complete!',
  'player.dictation.allSkippedBody':
    'All {count} words were skipped. Try typing next time — spelling practice sticks fast.',
  'player.dictation.pctCorrect': '{pct}% spelled correctly',
  'player.dictation.listeningTitle': 'Listening…',
  'player.dictation.modeTitle': 'Dictation mode',
  'player.dictation.listeningIntro': 'Hear the word, then type what it sounds like.',
  'player.dictation.modeIntro': 'Press play to hear a word with its spelling hidden.',
  'player.dictation.itemN': 'Dictation {current} / {total}',
  'player.dictation.correctFeedback': 'Spelled it! ✓',
  'player.dictation.wrongFeedback': '✗ Not quite — study the spelling above',
  'player.dictation.revealedFeedback': 'Revealed — note the spelling',
  'player.dictation.placeholder': 'Type what you hear…',
  'player.dictation.inputAria': 'Type the word you hear',
  'player.dictation.check': 'Check',
  'player.dictation.reveal': 'Reveal',
  'player.dictation.replay': 'Replay',
  'player.dictation.skip': 'Skip →',

  // WordNavigator
  'player.nav.title': 'Find a word',
  'player.nav.count': '{count} words in the current play order',
  'player.nav.closeAria': 'Close word search',
  'player.nav.searchSr': 'Search target word or translation',
  'player.nav.searchPlaceholder': 'Search word or translation…',
  'player.nav.clear': 'Clear',
  'player.nav.listAria': 'Words',
  'player.nav.noMatches': 'No matching words found.',
  'player.nav.playing': 'Playing',

  // ProgressBar
  'player.progress.jumpAria': 'Jump to a word',
  'player.progress.openSearchAria': 'Open word search, current word {label}',

  // PrewarmStatus
  'player.prewarm.pillTitle':
    'Caching audio for offline / lock-screen playback — {done} of {total} done',
  'player.prewarm.pill': 'Caching audio… {done}/{total}',
  'player.prewarm.summary': '{done} of {total} cached',
} as const;

export type PlayerKeys = keyof typeof playerEn;
