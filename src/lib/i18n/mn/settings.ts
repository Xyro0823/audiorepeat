/**
 * Монгол strings for the Settings modal. Natural phrasing over literal
 * translation; placeholders ({count}, {limit}, {lang}, {who}) are preserved.
 */
import type { SettingsKeys } from '../en/settings';

export const settingsMn: Record<SettingsKeys, string> = {
  'settings.title': '⚙️ Тохиргоо',
  'settings.aria.label': 'Тохиргоо',
  'settings.close.aria': 'Тохиргоог хаах',
  'settings.tab.language': '🌐 Хэл',
  'settings.tab.playback': '🎛️ Тоглолт',
  'settings.tab.appearance': '🎨 Харагдац',
  'settings.tab.data': '💾 Мэдээлэл',
  'settings.tab.reminders': '🔔 Сануулга',

  'settings.uiLang.title': 'Интерфэйсийн хэл',
  'settings.uiLang.hint':
    'Зөвхөн цэс, товч, бичвэрийн хэл өөрчлөгдөнө. Та сурч буй хэлэндээ ямар ч нөлөөгүй.',

  'settings.practice.lang': 'Сурах хэл',
  'settings.pro.lang.line':
    'Pro төлөвлөгөө — дэмжигдсэн бүх {count} хэл дээр багц үүсгэх боломжтой.',
  'settings.free.lang.line':
    'Үнэгүй төлөвлөгөөнд {limit} идэвхтэй хэл багтана. Бүх {count} хэлийг ашиглахын тулд Pro руу шинэчлээрэй.',
  'settings.default.new.set.lang': 'Шинэ багцийн стандарт хэл',
  'settings.auto.set.lang': 'Авто — багцийн хэлээр',
  'settings.full.pack.suffix': ' · бүрэн CEFR багц',
  'settings.default.set.lang.hint':
    'Шинэ багцууд энэ хэлээр үүснэ. Багц бүрээр тусад нь өөрчилж болно.',
  'settings.not.selected.yet': 'Одоогоор сонгоогүй',
  'settings.current': 'Идэвхтэй',
  'settings.change.language': 'Хэл солих',
  'settings.upgrade.all.languages': '⭐ Бүх {count} хэлийг нээхийн тулд Pro руу шинэчлэх',
  'settings.switching.hint':
    'Хэл солиход бусад хэлүүд нуугдана — Pro болоход буцааж гарна. Юу ч устгагдахгүй.',
  'settings.voice.availability': 'Дуу хоолойн боломж',
  'settings.voice.availability.body':
    'Төхөөрөмжийн хоолойнууд шууд тоглоно. Ямар нэг хоолой байхгүй үед аюулгүй клаудаар нэг удаа үүсгээд офлайн тоглуулахад кэшлэж болно.',
  'settings.cloud.voices.toggle': 'Аюулгүй клауд дуу хоолой ашиглах',
  'settings.cloud.voices.hint':
    'Дуудаад буй үг л Microsoft Azure руу илгээгдэж, аудио нь энэ төхөөрөмжид кэшлэгддэг',
  'settings.pro.cloud.title': '⭐ Клауд дуу хоолой, офлайн аудио багц нь Pro-ны давуу эрх',
  'settings.pro.cloud.body':
    'Үнэгүй төлөвлөгөө энэ төхөөрөмжид суусан стандарт хоолойг ашигладаг. Pro нь дутуу хоолойг клаудаар үүсгээд офлайн тоглуулахад кэшлэж чадна.',
  'settings.upgrade.to.pro': 'Pro руу шинэчлэх',
  'settings.cloud.not.configured': 'Клауд дуу хоолой энэ сервер дээр одоогоор тохируулаагүй байна.',
  'settings.loading.voices': 'Дуу хоолойг ачаалж байна…',
  'settings.voice.legend':
    'Ногоон = энэ төхөөрөмжид суусан. Цэнхэр = офлайн кэштэй аюулгүй клауд хоолой.',
  'settings.voice.legend.gray': ' Саарал = клауд дуу хоолой одоогоор тохируулаагүй.',

  'settings.repeat.each.word': 'Үг бүрийг давтах',
  'settings.repeat.hint': 'Давталтын дараа орчуулгыг үргэлж нэг удаа уншина.',
  'settings.default.speed': 'Стандарт тоглуулах хурд',
  'settings.speed.hint':
    'Тоглогчийн самбарт энэ удаадын нарийвчилсан 0.5×–2× гулсуур бас байдаг.',
  'settings.pause.before.translation': 'Орчуулгаас өмнөх завсарлага',
  'settings.target.voice.label': 'Үг унших стандарт хоолой ({lang})',
  'settings.translation.voice.label': 'Орчуулга унших стандарт хоолой',
  'settings.voices.override.hint':
    'Эдгээр хоолойг бүх багцад ижил ашиглана — зөвхөн багц өөрөө тохируулсан тохиолдолд өөрчлөгдөнө (Давталтын тохиргоо → “Энэ багцад зориулсан тохиргоо”).',

  'settings.theme': 'Загвар',
  'settings.theme.neon.label': 'Харанхуй шил',
  'settings.theme.neon.desc': 'Гүн нүүрсэн дэвсгэр, цэнхэр гэрэлтэлттэй',
  'settings.theme.dark.label': 'Харанхуй горим',
  'settings.theme.dark.desc': 'Зөөлөн нүүрсэн өнгө, тайван акценттэй',
  'settings.theme.light.label': 'Цэвэр гэгээлэг',
  'settings.theme.light.desc': 'Гэгээлэг дэвсгэр, бүдэг хар тексттэй',
  'settings.hints.toggle': 'Үгний карт дээр эмодзи тусламж',
  'settings.hints.hint': 'Үг бүрд нөхцөлд таарах эмодзи — офлайн ажиллана',
  'settings.examples.toggle': 'Жишээ өгүүлбэр',
  'settings.examples.hint': 'Үгэнд жишээ өгүүлбэр байвал үзүүлнэ',
  'settings.cloud.speech.on':
    'Төхөөрөмжид байхгүй хоолойд клауд дуу хоолой идэвхтэй. Үүсгэсэн аудио офлайн тоглуулахад кэшлэгдэнэ.',
  'settings.cloud.speech.available.off':
    'Клауд дуу хоолой боломжтой ч унтраалттай. Байхгүй хоолойг ашиглахын тулд Хэл табнаас идэвхжүүлээрэй.',
  'settings.cloud.speech.pro.only':
    'Клауд дуу хоолой, офлайн аудио багц нь Pro-ны давуу эрх — Үнэгүй төлөвлөгөө таны төхөөрөмжийн хоолойг ашиглана.',
  'settings.cloud.speech.unconfigured':
    'Клауд дуу хоолой одоогоор тохируулаагүй тул тоглолт төхөөрөмжийн хоолойгоор явагдана.',

  'settings.account': 'Данс',
  'settings.account.signed.in':
    '{who} нэрээр Firebase-д нэвтэрсэн. Таны данс онлайн синк хийгддэг; статистик, тасралтгүй өдрүүд, багцууд энэ төхөөрөмжид үлдэнэ.',
  'settings.account.guest':
    'Та аппыг зочин горимд ашиглаж байна. Дээд талбарын цэснээс Google эсвэл имэйл дансаараа нэвтэрч болно.',
  'settings.account.unconfigured':
    'Firebase одоогоор тохируулаагүй байна — нэвтрэхийг идэвхжүүлэхийн тулд .env.local файлдаа тохиргоогоо нэмээрэй (.env.example-г үзнэ үү). Энэ үед апп зочин горимд ажиллана.',
  'settings.view.plans': 'Төлөвлөгөөг үзэх',
  'settings.upgrade': 'Шинэчлэх',
  'settings.switch.to.free': 'Үнэгүй рүү шилжих',
  'settings.backup.title': 'Нөөцлөх, сэргээх',
  'settings.backup.body':
    'Багц, тохиргоо, статистик, харагдах нэрээ нэг JSON файлд нөөцлөөд дурын төхөөрөмж дээр сэргээж болно.',
  'settings.export.backup': '⬇ Нөөц экспортлох',
  'settings.import.backup': '⬆ Нөөц импортлох',
  'settings.cache.title': 'Кэш',
  'settings.cache.body':
    'Хуучин локал кэшлэгдсэн аудиог эндээс цэвэрлэж болно. Офлайн үед шинэ аудио үүсгэхгүй.',
  'settings.clear.cached.audio': '🗑 Кэшлэгдсэн аудио цэвэрлэх',
  'settings.reset.progress.title': 'Дадлагын ахицыг дахин эхлүүлэх',
  'settings.reset.progress.body':
    'Тасралтгүй өдрүүд, өдрийн статистик, үгийн эзэмшлэл арилна. Таны багцууд хэвээр үлдэнэ.',
  'settings.reset.progress.confirm': 'Тийм, бүгдийг дахин эхлүүлье',
  'settings.reset.progress.button': 'Ахиц дахин эхлүүлэх…',

  'settings.flash.backup.downloaded': 'Нөөц татагдлаа — найдвартай газар хадгална уу.',
  'settings.flash.invalid.backup': 'Энэ файл AudioRepeat-ийн хүчинтэй нөөц файл биш байна.',
  'settings.flash.read.failed': 'Энэ нөөц файлыг уншиж чадсангүй.',
  'settings.flash.restored': 'Нөөц сэргээгдлээ — дахин ачааллаж байна…',
  'settings.flash.restore.failed': 'Сэргээж чадсангүй — аппыг дахин ачаалаад өөрийн мэдээллээ шалгана уу.',
  'settings.flash.clear.cache.failed': 'Аудионы кэшийг цэвэрлэж чадсангүй.',
  'settings.flash.cache.cleared': '{count} кэшлэгдсэн аудио цэвэрлэгдлээ.',
  'settings.flash.no.cached.audio': 'Кэшлэгдсэн аудио олдсонгүй.',
  'settings.flash.reset.failed': 'Дахин эхлүүлж чадсангүй.',
  'settings.flash.notifications.unsupported': 'Энэ хөтөч мэдэгдлийг дэмждэггүй байна.',
  'settings.flash.permission.denied':
    'Зөвшөөрөл олгогдсонгүй — хөтчийн тохиргооноос мэдэгдлийг зөвшөөрөөрэй.',
  'settings.flash.reminders.need.pwa':
    'Сануулгад суусан PWA (албан ёсны хувилбар) шаардлагатай — туршилтын горимд боломжгүй.',
  'settings.flash.test.sent': 'Туршилтын мэдэгдэл илгээгдлээ (мэдэгдлийн төвөөсөө шалгана уу).',
  'settings.flash.test.failed': 'Суусан аппын мэдэгдлийн үйлчилгээтэй холбогдож чадсангүй.',

  'settings.restore.question': 'Нөөцийг сэргээх үү?',
  'settings.restore.body':
    'Одоогийн сан, тохиргоо, статистик, харагдах нэрээ нөөцөөр солино ({count} багц).',
  'settings.restore.button': 'Сэргээх',

  'settings.reminders.unsupported.body':
    'Өдөр тутмын сануулгад Service Worker + Notification API шаардлагатай. Аппыг PWA болгон суулгасан үед (албан ёсны хувилбар) ажилладаг — туршилтын горимд үгүй.',
  'settings.daily.reminder.toggle': 'Өдөр тутмын дадлагын сануулга',
  'settings.daily.reminder.hint': 'Сонгосон цагт дадлага хийхийг мэдэгдлээр сануулна',
  'settings.remind.me.at': 'Сануулах цаг',
  'settings.send.test.notification': 'Туршилтын мэдэгдэл илгээх',
  'settings.reminders.triggers.hint':
    'Хөтчийн Notification Triggers API-г ашигладаг тул апп хаалттай үед ч сануулга ажиллана (Chrome компьютер, Android). Аппыг нээх бүрд дахин идэвхжинэ.',
  'settings.reminders.blocked.note':
    'Мэдэгдлийг хөтчийн тохиргоонд хаасан байна. Сануулгыг идэвхжүүлэхийн тулд блоклолтыг авах уу.',
};
