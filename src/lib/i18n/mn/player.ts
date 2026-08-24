import type { PlayerKeys } from '../en/player';

// Mongolian strings for the player area. Natural UI phrasing; placeholders
// ({count}, {index}, …) are preserved exactly as in English.
export const playerMn: Record<PlayerKeys, string> = {
  // Global player states
  'player.state.loading': 'Ачааллаж байна…',
  'player.state.setNotFound': 'Багц олдсонгүй',
  'player.state.setNotFoundBody': 'Устгагдсан байж магадгүй.',
  'player.state.backToLibrary': 'Сан руу буцах',

  // Header
  'player.header.library': 'Сан',
  'player.header.libraryAria': 'Сан руу буцах',
  'player.header.wordsAll': '{count} үг',
  'player.header.wordsFiltered': '{shown} / {total} үг',

  // Filter / mode row
  'player.filter.all': 'Бүгд',
  'player.filter.learning': 'Сурч буй',
  'player.filter.review': 'Давтах',
  'player.filter.hintLearning': 'хараахан эзэмшээгүй үгс',
  'player.filter.hintHard': 'давтахад тэмдэглэсэн үгс',
  'player.filter.reviewProTitle': 'Интервал давталтын шүүлтүүр нь Pro-ны давуу эрх',
  'player.filter.reviewProLabel': 'Давтах · Pro',
  'player.filter.freeLangTitle':
    'Үнэгүй төлөвлөгөөнд {limit} идэвхтэй хэл багтана — бүх хэлийг нээхийн тулд Pro руу шинэчлээрэй',
  'player.filter.freeLangLabel': 'Үнэгүй · {limit} хэл',
  'player.filter.quiz': 'Тест',
  'player.filter.quizEmpty': 'Энэ шүүлтүүрээр тест хийх үг байхгүй',
  'player.filter.quizHow': 'Үгийг тоглуулж сонсоод, дөрвөн сонголтоос орчуулгыг нь ол',
  'player.filter.quizProTitle': 'Тестийн горим нь Pro-ны давуу эрх',
  'player.filter.dictation': 'Диктант',
  'player.filter.dictationEmpty': 'Энэ шүүлтүүрээр диктант хийх үг байхгүй',
  'player.filter.dictationHow':
    'Үгийг үсгийн дарааллыг нууж сонсоод, сонссоноо бич',
  'player.filter.sleepCancelTitle': 'Унтах таймер идэвхтэй — цуцлах бол дар',
  'player.filter.snoozeTitle':
    '30 секундийн дотор Play дарвал таймер дахин эхэлнэ, эсвэл энд дарж хаана',
  'player.filter.snoozeLabel': '⏰ Сунгах {time}',

  // Filtered-to-empty state
  'player.empty.title': 'Бүгд давтаж дууслаа! 🎉',
  'player.empty.hardBody':
    'Давтахад тэмдэглэсэн үг алга байна. Дадлага хийхдээ дахин давахыг хүссэн үг дээрээ «Давтах» товчийг дараарай.',
  'player.empty.masteredBody': 'Энэ багцийн бүх үг эзэмшсэн байна.',
  'player.empty.playAll': 'Бүх {count} үгийг тоглуулах',

  // Free daily limit banner
  'player.limit.title': 'Өдрийн Үнэгүй хязгаарт хүрлээ',
  'player.limit.body':
    'Үнэгүй төлөвлөгөөнд өдөрт {limit} үг багтана. Хязгаар шөнө шинэчлэгдэнэ — эсвэл Pro-гоор хязгааргүй дадлагажираарай.',
  'player.limit.upgrade': 'Pro руу шинэчлэх',

  // Resume card
  'player.resume.heading': 'Сонсож үргэлжлүүлэх',
  'player.resume.wordLine': '{index}-р үг · {word}',
  'player.resume.startOver': 'Эхнээс эхлэх',
  'player.resume.cta': '▶ Үргэлжлүүлэх',

  // Cloud voice consent
  'player.cloudVoice.title': 'Энэ хэлийг цэвэр сонсоорой',
  'player.cloudVoice.body':
    'Энэ төхөөрөмжид тохирох хоолой байхгүй байна. AudioRepeat нь дуудаад буй үг л Microsoft Azure руу аюулгүй илгээд, аудиог энэ төхөөрөмжинд хадгалж чадна.',
  'player.cloudVoice.enable': 'Клауд дуу хоолойг идэвхжүүлэх',
  'player.cloudVoice.signInEnable': 'Нэвтэрч клауд дуу хоолойг идэвхжүүлэх',
  'player.cloudVoice.footer': 'Тохиргооноос аль ч үед унтрааж болно.',

  // Toasts
  'player.toast.cloudEnabled':
    'Клауд дуу хоолой идэвхжлээ. Аудиог дараагийн удаа шууд тоглуулахад кэшлэгдэнэ.',
  'player.toast.enableCloudVoice':
    'Энэ хэлийг цэвэр сонсохын тулд доорх клауд дуу хоолойг идэвхжүүлээрэй.',
  'player.toast.enableCloudForQuiz':
    'Тест эхлэхээс өмнө доорх клауд дуу хоолойг идэвхжүүлээрэй.',
  'player.toast.enableCloudForDictation':
    'Диктант эхлэхээс өмнө доорх клауд дуу хоолойг идэвхжүүлээрэй.',
  'player.toast.sleepEnded':
    '🌙 Унтах таймер дууслаа — 30 секундийн дотор Play дарвал сунгана.',
  'player.toast.freeLimit':
    'Үнэгүй төлөвлөгөөнд өдөрт {limit} үг багтана — хязгааргүй дадлагын тулд Pro руу шинэчлээрэй.',

  // WordCard
  'player.card.readyTitle': 'Та бэлэн бол эхэлье',
  'player.card.readyBody':
    'Play дархад үг бүрийг сурах хэлээр нь хэд хэдэн удаа сонсоод, дараа нь орчуулгыг нь сонсно.',
  'player.card.targetPos': 'Үг · {index} / {total}',
  'player.card.translationPos': 'Орчуулга · {index} / {total}',
  'player.card.noVoiceTitle':
    'Энэ хэлний дуу хоолой таны төхөөрөмжид суугдаагүй байна — аудио дуугүй гарах эсвэл буруу хэлээр тоглох магадлалтай. Тохиргооноос хоолой сонгоорой.',
  'player.card.noVoice': 'Энэ хэлний хоолой байхгүй',
  'player.card.cloudVoiceTitle':
    'Энэ хэлэнд төхөөрөмжийн хоолой суугдаагүй тул AudioRepeat аюулгүй клауд дуу хоолойг ашиглаж, үр дүнг офлайн тоглуулалтад кэшлэж байна.',
  'player.card.cloudVoice': 'Клауд хоолой · анхны тоглолтын дараа кэшлэгдсэн',
  'player.card.repeatN': 'Давталт {current} / {total}',
  'player.badge.mastered': 'эзэмшсэн',
  'player.badge.review': 'давтах',
  'player.mastery.unmark': 'Тэмдэглэгээ авах',
  'player.mastery.markKnown': 'Мэддэг гэж тэмдэглэх',
  'player.mastery.known': 'Мэддэг',
  'player.mastery.markReview': 'Давтахад тэмдэглэх',
  'player.mastery.review': 'Давтах',
  'player.mastery.proTitle': 'Үгийг Мэддэг/Давтах гэж тэмдэглэх нь Pro-ны давуу эрх',
  'player.mastery.proCta': 'Эзэмшлийг хянах — Pro',

  // Shared badges & hints
  'player.hint.emoji': 'Эмодзи тусламж',
  'player.scoreBadge': '{correct}/{total} зөв',
  'player.playAgain': '▶ Дахин тоглуулах',

  // PlayerControls
  'player.controls.prevAria': 'Өмнөх үг рүү очих',
  'player.controls.replayAria': 'Одоогийн үгийг дахин тоглуулах',
  'player.controls.prevTitle': 'Өмнөх үг',
  'player.controls.play': 'Тоглуулах',
  'player.controls.pause': 'Түр зогсоох',
  'player.controls.nextWord': 'Дараах үг рүү шилжих',
  'player.controls.stop': 'Зогсоох',
  'player.controls.speedAria': 'Тоглуулах хурд {speed}×',
  'player.controls.speedTitle': 'Тоглуулах хурд — дарж өөрчилнө',
  'player.controls.shuffleOn': 'Холих горим асаалттай — унтраах бол дар',
  'player.controls.shuffleOff':
    'Холих горим унтраалттай — дарааллыг санамсаргүй болгох бол дар',

  // SettingsPanel
  'player.settings.title': 'Давталтын тохиргоо',
  'player.settings.thisSet': 'энэ багц',
  'player.settings.customizeSet': 'Энэ багцад зориулсан тохиргоо',
  'player.settings.customHintOn': 'Доорх өөрчлөлт зөвхөн энэ багцад хамаатай',
  'player.settings.customHintOff': 'Доорх өөрчлөлт бүх багцад хамаатай',
  'player.settings.repeats': 'Нэг үгийн давталтын тоо',
  'player.settings.repeatHint': 'Давталтын дараа орчуулгыг үргэлж нэг удаа уншина.',
  'player.settings.speed': 'Хурд',
  'player.settings.gapBefore': 'Орчуулгаас өмнөх завсарлага',
  'player.settings.gapAfter': 'Орчуулгын дараах завсарлага',
  'player.settings.loopList': 'Жагсаалтыг бүтнээр нь давтах',
  'player.settings.cloudOn':
    'Байхгүй хоолойнууд аюулгүй клаудаар тоглоод, офлайн тоглуулахад кэшлэгддэг.',
  'player.settings.cloudAvailableOff':
    'Клауд дуу хоолой боломжтой ч унтраалттай. Тохиргоо → Хэл хэсгээс идэвхжүүлээрэй.',
  'player.settings.cloudUnconfigured':
    'Клауд дуу хоолой одоогоор тохируулаагүй; төхөөрөмжийн хоолой ашиглагдана.',
  'player.settings.showHints': 'Үгний карт дээр эмодзи тусламж харуулах',
  'player.settings.showHintsHint': 'Үг бүрд нөхцөлд таарах эмодзи — офлайн ажиллана',
  'player.settings.sleepTimer': 'Унтах таймер',
  'player.settings.sleepOff': 'Унтраалттай',
  'player.settings.sleepPlaceholder': 'Өөр',
  'player.settings.sleepInputAria': 'Унтах таймерийн минут',
  'player.settings.sleepActive':
    '🌙 {time} дараа зогсоно — сүүлийн 15 секундэд дуу аажмаар намжина.',
  'player.settings.sleepHint':
    'Сүүлийн 15 секундэд дуу аажмаар намжсаар, тоглолт зогсоно.',
  'player.settings.targetVoice': 'Үг унших хоолой ({lang})',
  'player.settings.translationVoice': 'Орчуулга унших хоолой ({lang})',

  // QuizCard
  'player.quiz.completeTitle': 'Тест дууслаа!',
  'player.quiz.allSkippedBody':
    '{count} асуултыг бүгд алгассан байна. Дараагийн удаа хариулаад үзээрэй — үг бүрд шууд дүгнэлт авна.',
  'player.quiz.pctCorrect': '{pct}% зөв',
  'player.quiz.modeTitle': 'Тестийн горим',
  'player.quiz.modeIntro': 'Тоглуулаад үгийг сонсоод, сонголтоос орчуулгыг нь ол.',
  'player.quiz.questionN': 'Асуулт {current} / {total}',
  'player.quiz.pickTranslation': 'Орчуулгыг нь сонгоорой',
  'player.quiz.correct': 'Зөв! ✓',
  'player.quiz.itWas': '✗ Зөв хариулт нь "{answer}" байсан',
  'player.quiz.replayWord': 'Үгийг дахин тоглуулах',

  // DictationCard
  'player.dictation.completeTitle': 'Диктант дууслаа!',
  'player.dictation.allSkippedBody':
    '{count} үгийг бүгд алгассан байна. Дараагийн удаа бичиж үзээрэй — бичгийн дадлага хурдан сууна.',
  'player.dictation.pctCorrect': '{pct}% зөв бичсэн',
  'player.dictation.listeningTitle': 'Сонсож байна…',
  'player.dictation.modeTitle': 'Диктантын горим',
  'player.dictation.listeningIntro': 'Үгийг сонсоод, сонссоноо бичээрэй.',
  'player.dictation.modeIntro':
    'Тоглуулаад үгийг үсгийн дараалал нуугдсан байдлаар сонсоорой.',
  'player.dictation.itemN': 'Диктант {current} / {total}',
  'player.dictation.correctFeedback': 'Зөв бичлээ! ✓',
  'player.dictation.wrongFeedback': '✗ Бага зэрэг буруу — дээрх зөв бичвэрийг хар',
  'player.dictation.revealedFeedback': 'Харууллаа — үсгийн дарааллыг анзаараарай',
  'player.dictation.placeholder': 'Сонссоноо бичээрэй…',
  'player.dictation.inputAria': 'Сонссон үгээ бичнэ үү',
  'player.dictation.check': 'Шалгах',
  'player.dictation.reveal': 'Харуулах',
  'player.dictation.replay': 'Дахин тоглуулах',
  'player.dictation.skip': 'Алгасах →',

  // WordNavigator
  'player.nav.title': 'Үг олох',
  'player.nav.count': 'Одоо тоглож буй дараалалд {count} үг байна',
  'player.nav.closeAria': 'Үг хайхыг хаах',
  'player.nav.searchSr': 'Үг эсвэл орчуулга хайх',
  'player.nav.searchPlaceholder': 'Үг эсвэл орчуулга хайх…',
  'player.nav.clear': 'Цэвэрлэх',
  'player.nav.listAria': 'Үгс',
  'player.nav.noMatches': 'Тохирох үг олдсонгүй.',
  'player.nav.playing': 'Тоглож байна',

  // ProgressBar
  'player.progress.jumpAria': 'Үг рүү шилжих',
  'player.progress.openSearchAria': 'Үг хайхыг нээх, одоогийн үг {label}',

  // PrewarmStatus
  'player.prewarm.pillTitle':
    'Аудиог офлайн болон дэлгэц түгжигдсэн үед тоглуулахад кэшлэж байна — {done}/{total} бэлэн',
  'player.prewarm.pill': 'Аудио кэшлэж байна… {done}/{total}',
  'player.prewarm.summary': '{done}/{total} кэшлэгдсэн',
};
