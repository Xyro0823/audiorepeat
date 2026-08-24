import type { LibraryKeys } from '../en/library';

// Mongolian strings for the library area. Keys/placeholders must mirror
// en/library.ts exactly (compile-checked by Record<LibraryKeys, string>).
export const libraryMn: Record<LibraryKeys, string> = {
  // ---- Сангийн хэсэгт нийтлэг ----
  'library.wordsCount': '{count} үг',
  'library.masteredPct': '{pct}% эзэмшсэн',
  'library.pickLanguage': 'Хэл сонгох',
  'library.preview': 'Урьдчилан харах',
  'library.typeToSearch': 'Хайхын тулд бичиж эхлүүлээрэй',
  'library.confirmDelete': 'Устгалыг батлах',
  'library.keepWords': 'Үгсийг хадгалах',
  'library.proFeature': 'Pro функц',

  // CEFR түвшингийн нэрс (A1–C2 кодыг орчуулахгүй)
  'library.cefr.A1': 'Эхлэгч',
  'library.cefr.A2': 'Суурь',
  'library.cefr.B1': 'Дунд',
  'library.cefr.B2': 'Дунд дээд',
  'library.cefr.C1': 'Ахисан',
  'library.cefr.C2': 'Мэргэжлийн',

  // ---- Дээд самбар / шинэ багцын цэс ----
  'library.newSet.title': 'Шинэ багц үүсгэх эсвэл импортлох',
  'library.newSet.newSet': 'Шинэ багц',
  'library.newSet.importJson': 'Импортлох (JSON)',
  'library.tagline': '{count} хэл · гар чөлөөтэй дадлага',

  // ---- Түр гарах мэдэгдлүүд ----
  'library.flash.invalidFile': 'Энэ файл AudioRepeat-ийн зөв багц биш байна.',
  'library.flash.imported': 'Импортлогдлоо: “{name}” ({count} үг).',
  'library.flash.readFailed': 'Энэ файлыг уншиж чадсангүй.',
  'library.flash.readSubtitleFailed': 'Энэ субтитрын файлыг уншиж чадсангүй.',
  'library.flash.badShareLink': 'Хуваалцах холбоос буруу эсвэл гэмтсэн байна.',
  'library.flash.starterFailed': 'Энэ бэлэн багцыг импортлож чадсангүй.',

  // ---- Онцлох багцын карт ----
  'library.featured.editorsPick': 'Засварлагчийн сонголт',
  'library.featured.deviceSpeech': 'Төхөөрөмжийн дуу хоолой',
  'library.featured.ofDay': 'Өдрийн онцлох багц',
  'library.featured.meta': '{target} → {native} · {count} үг',
  'library.featured.metaCefr': ' · {level} {label}',
  'library.featured.body':
    '{lang} хэлний чухал {count} үгийг аудио давталтаар, гараар юу ч хийлгүй тогтооорой — замдаа, гэр ажилдаа, амрахдаа тохирно.',
  'library.featured.knownCount': '{count} үг мэддэг болсон',
  'library.featured.startLearning': 'Сурч эхлэх',

  // ---- Багцын карт ба үйлдлийн цэс ----
  'library.card.actionsAria': '{name}-н үйлдлүүд',
  'library.card.challenge': '1 минутын сорил',
  'library.card.downloadJson': 'JSON татах',
  'library.card.copyShareLink': 'Хуваалцах холбоосыг хуулах',
  'library.card.customSettings': ' · тохируулсан тохиргоо',
  'library.card.toReview': '{count} давтах',
  'library.card.quickTestTitle': '1 минутын хурдан сорил',
  'library.card.proTestTitle': 'Хурдны сорил бол Pro функц',
  'library.card.quickTest': 'Хурдан сорил',
  'library.card.test': 'Сорил',

  // ---- Зүүн талын самбар ----
  'library.sidebar.featuredLanguages': 'Онцлох хэлнүүд',
  'library.sidebar.playAria': '{name}-г тоглуулах',
  'library.sidebar.continuePractice': 'Дадлагаа үргэлжлүүлэх',
  'library.sidebar.playLast': 'Сүүлийн дадлагыг тоглуулах',
  'library.sidebar.recentsEmpty':
    'Аль ч багцаар дадлаж үзээрэй — энд хадгалагдаж, зогссон газраасаа үргэлжлүүлж болно.',
  'library.sidebar.today': 'Өнөөдөр',
  'library.sidebar.wordsListened': 'Сонссон үгс',
  'library.sidebar.studyTime': 'Сурсан хугацаа',
  'library.sidebar.streak': 'Тасралтгүй',
  'library.sidebar.streakDays': '🔥 {count} хоног',

  // ---- Багцын хүснэгт ----
  'library.grid.title': 'Хэлний багцууд ба сан',
  'library.grid.loading': 'Багцуудаа ачаалж байна…',
  'library.grid.filteredSummary': '{shown}/{total} багц · {words} үг · {langs} хэл',
  'library.grid.summary': '{sets} багц · {words} үг · {langs} хэл',
  'library.grid.searchPlaceholder': 'Багц эсвэл хэл хайх…',
  'library.grid.searchAria': 'Багц хайх',
  'library.grid.filterCefrAria': 'CEFR түвшингээр шүүх',
  'library.grid.filterLangAria': 'Хэлээр шүүх',
  'library.grid.allLanguages': 'Бүх хэл',
  'library.grid.clearFilters': 'Шүүлтүүрийг цэвэрлэх',
  'library.grid.emptyTitle': 'Одоогоор үгийн багц алга',
  'library.grid.emptyBody':
    '+ Шинэ товч дээр дарж анхныхаа багцыг үүсгэх, JSON импортлох, эсвэл бэлэн сангаас сонгоорой.',
  'library.grid.browseStarter': 'Бэлэн сан үзэх',
  'library.grid.noMatchTitle': 'Шүүлтүүрт таарах багц алга',
  'library.grid.noMatchBody': 'Өөр хайлт, түвшин, эсвэл хэлээр оролдоно уу.',

  // ---- Сан үзэх цонх (эхний багцууд) ----
  'library.starter.title': 'Бэлэн сан',
  'library.starter.subtitleTopics':
    'Өдөр тутмын нөхцөл байдлын сэдэвчилсэн үгийн багцууд — хэл бүрээр нэгийг импортлох.',
  'library.starter.subtitleFull':
    '{langs} хэл дээрх иж бүрэн CEFR үгийн багцууд — нийт {words} үг. Түвшин импортлох, эсвэл багцаар дадлага хийх.',
  'library.starter.subtitlePlain':
    'Иж бүрэн CEFR үгийн багцууд — түвшин импортлох, эсвэл багцаар дадлага хийх.',
  'library.starter.tabCefr': 'CEFR түвшингүүд',
  'library.starter.tabTopics': 'Сэдвүүд',
  'library.starter.loadingLibrary': 'Үгийн санг ачаалж байна…',
  'library.starter.errorUnavailable': 'Үгийн сан одоогоор боломжгүй — онлайнаар дахин оролдоно уу.',
  'library.starter.errorLevel': 'Энэ түвшинг ачаалж чадсангүй.',
  'library.starter.optionMeta': ' · {count} үг',
  'library.starter.chipCount': '{count} үг',
  'library.starter.notYet': 'Одоогоор байхгүй',
  'library.starter.searchPlaceholder': '{lang} үгс хайх…',
  'library.starter.batch': 'Түүвэр',
  'library.starter.pickLangBody': 'Үгийн багцуудыг үзэхийн тулд хэл сонгоно уу.',
  'library.starter.pickLevelBody': 'Үгсийг харахын тулд түвшин сонгоно уу.',
  'library.starter.levelsHint':
    'Түвшин бүр бүрэн дадлагын цомог — A1/A2 ≈ 200–300 үг, B1/B2 ≈ 500, C1/C2 ≈ 1,000.',
  'library.starter.loadingLevel': '{count} үгийг ачаалж байна…',
  'library.starter.matches': 'таарсан',
  'library.starter.wordsInLevel': 'энэ түвшний үг',
  'library.starter.ofTotal': ', нийт {count}-оос',
  'library.starter.practiceBatch': '▶ {count} үгээр дадлага хийх',
  'library.starter.playAllTitle': 'Түвшинг бүхэлд нь нэг багц болгон импортож, бүх үгийг тоглуулах',
  'library.starter.playAll': '⬇ Бүгдийг тоглуулах',
  'library.starter.playAllCount': '({count})',
  'library.starter.previewHeader': 'Урьдчилан харах — {count} үг (гүйлгэж үзнэ үү)',
  'library.starter.noMatch': '“{query}”-д таарах үг олдсонгүй.',
  'library.starter.progressLevels': '{imported}/{available} түвшин импортлогдсон',
  'library.starter.progressWords': ' · {count} үг',

  // ---- Сэдвийн таб (сан үзэх цонхонд) ----
  'library.topics.errorUnavailable': 'Сэдвүүд одоогоор боломжгүй — онлайнаар дахин оролдоно уу.',
  'library.topics.errorLoad': 'Энэ сэдвийг ачаалж чадсангүй.',
  'library.topics.loadingTopics': 'Сэдвүүдийг ачаалж байна…',
  'library.topics.cardMeta': '{words} үг · {langs} хэл',
  'library.topics.loadingWords': 'Үгсийг ачаалж байна…',
  'library.topics.importTopic': 'Сэдвийг импортлох',
  'library.topics.noWords': 'Энэ хэлэнд одоогоор үг байхгүй.',

  // ---- Багцын засварлагч ----
  'library.editor.editTitle': 'Багц засах',
  'library.editor.newTitle': 'Шинэ үгийн багц',
  'library.editor.setName': 'Багцын нэр',
  'library.editor.namePlaceholder': 'жишээ нь: Герман суурь',
  'library.editor.targetLanguage': 'Сурах хэл',
  'library.editor.targetPlaceholder': 'жишээ нь: es-ES эсвэл Испани (Испани)',
  'library.editor.speakingHint': 'Унших хэл: {lang}',
  'library.editor.nativeLanguage': 'Төрөлх хэл',
  'library.editor.nativePlaceholder': 'жишээ нь: en-US',
  'library.editor.translationsHint': 'Орчуулгын хэл: {lang}',
  'library.editor.cefrLabel': 'CEFR түвшин (сонголттой)',
  'library.editor.noLevel': 'Түвшингүй',
  'library.editor.selectAll': 'Бүх үгийг сонгох',
  'library.editor.deselectAll': 'Бүх үгийг сонголтоос хасах',
  'library.editor.wordsCount': 'Үгс ({count})',
  'library.editor.repeatsHint': 'давталт: үг бүрт 1×–5×, дараа нь орчуулгыг нэг удаа',
  'library.editor.selectedCount': '{count} сонгогдсон',
  'library.editor.targetInputPlaceholder': 'Үг (gracias)',
  'library.editor.translationInputPlaceholder': 'Орчуулга (thank you)',
  'library.editor.examplePlaceholder': 'Жишээ өгүүлбэр (сонголттой) — жишээ нь контекст дэх “{word}”',
  'library.editor.targetAria': '{n}-р үг',
  'library.editor.translationAria': '{n}-р орчуулга',
  'library.editor.exampleAria': '{n}-р жишээ өгүүлбэр',
  'library.editor.useDefaultRepeats': 'Ерөнхий тохиргоог ашиглах',
  'library.editor.repeatsN': '{count} давталт',
  'library.editor.addWord': '+ Үг нэмэх',
  'library.editor.saveError':
    'Энэ багцыг хадгалж чадсангүй. Өөрчлөлтүүд нээлттэй хэвээр байна — дахин оролдоно уу.',
  'library.editor.savePlay': 'Хадгалж тоглуулах',
  'library.editor.createPlay': 'Үүсгэж тоглуулах',

  // ---- Үгсийн бөөн үйлдэл (засварлагчид) ----
  'library.bulk.actionsAria': 'Үгсийн бөөн үйлдэл',
  'library.bulk.known': 'Мэддэг',
  'library.bulk.review': 'Давтах',
  'library.bulk.reset': 'Буцаах',
  'library.bulk.markedKnown': '{count} үгийг Мэддэг гэж тэмдэглэлээ.',
  'library.bulk.markedReview': '{count} үгийг Давтах гэж тэмдэглэлээ.',
  'library.bulk.markedReset': '{count} үгийг Сурч буй гэж тэмдэглэлээ.',
  'library.bulk.deleteQuestion': '{count} үгийг устгах уу?',
  'library.bulk.draftNote': 'Энэ нь зөвхөн одоогийн ноорогт нөлөөлнө. Багц хадгалахад хэрэгжинэ.',
  'library.bulk.deletedFromDraft': '{count} үгийг ноорогоос устгалаа.',
  'library.bulk.selectWord': '{name}-г сонгох',
  'library.bulk.wordNumber': '{n}-р үг',
  'library.bulk.deleteWord': '{name}-г устгах',
  'library.bulk.repeatsAria': '{n}-р үгийн давталт',

  // ---- Үнэгүй багцын хэлний түгжээ ----
  'library.lock.bodyOne': 'Энэ хэлэнд Pro шаардлагатай — Үнэгүй төлөвлөгөөнд {count} хэл багтана.',
  'library.lock.bodyMany': 'Энэ хэлэнд Pro шаардлагатай — Үнэгүй төлөвлөгөөнд {count} хэл багтана.',
  'library.lock.upgrade': 'Pro руу шинэчлэх',

  // ---- Багц хуваалах цонх ----
  'library.share.set': 'Багц хуваалах',
  'library.share.privacyLine': '{count} үг · ахиц болон давталтын түүх нуугдсан хэвээр байна',
  'library.share.closeAria': 'Хуваалцах цонхыг хаах',
  'library.share.qrAlt': '{name}-н QR код',
  'library.share.qrTooLarge': 'Энэ багц QR кодонд багтахгүй. Оронд нь хуваалцах холбоосоо ашиглана уу.',
  'library.share.scanToImport': 'QR уншуулж импортлох',
  'library.share.recipientBody': 'Хүлээн авагч өөрийн санддаа шинэ хуулбар импортлоно.',
  'library.share.nativeText': 'AudioRepeat дээр “{name}”-г дадлагажуулах',
  'library.share.promptCopy': 'Энэ хуваалцах холбоосыг хуулах:',
  'library.share.linkCopied': '✓ Холбоосыг хуулсан',
  'library.share.copyLink': 'Холбоосыг хуулах',
  'library.share.downloadQr': 'QR зургийг татах',

  // ---- Хуваалцсан багцын импортын урьдчилан харалт ----
  'library.importPreview.eyebrow': 'Хуваалцсан багцын урьдчилан харалт',
  'library.importPreview.description': 'Сандаа шинэ хуулбар нэмэхийн өмнө багцыг шалгана уу.',
  'library.importPreview.closeAria': 'Импортын урьдчилан харалтыг хаах',
  'library.importPreview.detailsAria': 'Багцын дэлгэрэнгүй',
  'library.importPreview.learn': 'Сурах',
  'library.importPreview.translation': 'Орчуулга',
  'library.importPreview.cefrLevel': '{level} түвшин',
  'library.importPreview.sampleWords': 'Жишээ үгс',
  'library.importPreview.previewOnly': 'Зөвхөн урьдчилан харалт',
  'library.importPreview.moreWords': '+ өөр {count} үг',
  'library.importPreview.privacyNote':
    'Зөвхөн үгс болон тоглуулах тохиргоо ордог. Илгээгчийн Илгээгчийн Мэддэг/Давтах тэмдэглэл, дадлагын түүх нуугдсан хэвээр байна.',
  'library.importPreview.duplicateTitle': 'Санд аль хэдийн байна',
  'library.importPreview.duplicateBody':
    '“{name}” ижил хэл, үгийн агуулгатай тул давхар хуулбар үүсгэхгүй.',
  'library.importPreview.importError': 'Энэ багцыг импортлож чадсангүй. Таны сан өөрчлөгдөөгүй.',
  'library.importPreview.importing': 'Импортолж байна…',
  'library.importPreview.importSet': 'Багц импортлох',

  // ---- Субтитр импортлох цонх ----
  'library.subtitles.title': '🎬 Субтитр импортлох',
  'library.subtitles.keywords': 'түлхүүр үг',
  'library.subtitles.tokens': 'нийт үг',
  'library.subtitles.dialogLines': 'диалог мөр',
  'library.subtitles.languageLabel': 'Субтитрын хэл',
  'library.subtitles.langPlaceholder': 'жишээ нь: es-ES',
  'library.subtitles.hintPack': '{lang} — багцалсан үгийн санд офлайн орчуулга бүрэн таардаг',
  'library.subtitles.hintNoPack': '{lang} — багцын толь бичиг байхгүй; бүх орчуулгыг гараар нөхөх хэрэгтэй',
  'library.subtitles.mostFrequent': 'Хамгийн их тохиолдсон',
  'library.subtitles.showMore': 'Илүү үзүүлэх',
  'library.subtitles.noKeywords': 'Ашигтай түлхүүр үг олдсонгүй — энэ субтитрын файл уу?',
  'library.subtitles.matching': 'Орчуулга тааруулж байна…',
  'library.subtitles.createSet': 'Багц үүсгэх ({count} үг)',
  'library.subtitles.footnote':
    'Офлайн таарахгүй үгс “—” тэмдгээр үлдэнэ. Хадгалахаас өмнө нөхөхийн тулд багц засварлагч дээр нээгдэнэ.',

  // ---- Өдрийн амжилтын самбар ----
  'library.leaderboard.title': '🏆 Өдрийн амжилтын самбар',
  'library.leaderboard.closeAria': 'Амжилтын самбарыг хаах',
  'library.leaderboard.todayStats': '🔥 Тасралтгүй {streak} өдөр · {words} үг · өнөөдөр {time}',
  'library.leaderboard.rankBadge': '#1 байр',
  'library.leaderboard.accountNamePrefix': 'Таны бүртгэлийн нэр',
  'library.leaderboard.accountNameSuffix': 'таны амжилтын самбар дахь нэр болно.',
  'library.leaderboard.displayName': 'Харагдах нэр',
  'library.leaderboard.savedCheck': 'Хадгалсан ✓',
  'library.leaderboard.todayByLanguage': 'Өнөөдөр хэл тус бүрээр',
  'library.leaderboard.emptyTitle': 'Өнөөдөр дадлага хийгдээгүй',
  'library.leaderboard.emptyBody': 'Багц тоглуулаад амжилтын самбарт байр эзлээрэй.',
  'library.leaderboard.rowWords': '{count} үг',
  'library.leaderboard.footerNote':
    'AudioRepeat нь сервергүй, офлон тэргүүлсэн апп тул энэ самбар зөвхөн таны өдрийн дадлагыг хэл тус бүрээр эрэмбэлнэ. Ирээдүйд сервер нэмбэл найзуудын/нийтийн самбарт бэлэн байна.',
};
