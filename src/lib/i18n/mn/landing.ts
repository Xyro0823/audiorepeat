/**
 * Монгол strings for the public landing/marketing experience. Natural,
 * simple app-Mongolian; standardized terminology reused (Давтах, Сурах хэл,
 * багц, сан…). Placeholders preserved exactly; plan names/prices untouched.
 */
import type { LandingKeys } from '../en/landing';

export const landingMn: Record<LandingKeys, string> = {
  // Navbar
  'landing.nav.skip': 'Үндсэн агуулг руу алгасах',
  'landing.nav.home': 'AudioRepeat-ийн нүүр',
  'landing.nav.how': 'Хэрхэн ажилладаг',
  'landing.nav.demo': 'Туршилт',
  'landing.nav.features': 'Функцууд',
  'landing.nav.pricing': 'Үнэ',
  'landing.nav.faq': 'Асуулт ба хариулт',
  'landing.nav.signIn': 'Нэвтрэх',
  'landing.nav.dashboard': 'Дашборд',
  'landing.nav.startPractice': 'Дадлагажих',
  'landing.nav.uiLangAria': 'Интерфэйсийн хэл',

  // Hero
  'landing.hero.badge': 'Гар чөлөөтэй аудио дадлага',
  'landing.hero.titlePrefix': 'Ямар ч хэлийг',
  'landing.hero.titleAccent': 'сонсож, давтаж сур',
  'landing.hero.subtitle':
    'Замдаа, хоол хийж байхдаа эсвэл амарч байхдаа үгээ сонсож давтаарай. Давталт, ухаалаг хуваарь, {count} хэл — дэлгэц ширтэх шаардлагагүй.',
  'landing.hero.ctaPrimary': 'Одоо сурч эхэлье',
  'landing.hero.ctaSecondary': 'Сангаас сонгох',
  'landing.hero.tagline': 'Яарахгүй · Дарамтгүй · Зүгээр л сонсоорой',
  'landing.trust.title': 'Нууцлал тэргүүн',
  'landing.trust.body': 'Таны төхөөрөмжид буй дуу хоолойг ашиглана',

  // How it works
  'landing.how.kicker': 'Хэрхэн ажилладаг',
  'landing.how.title': 'Үгийн жагсаалтаас өдөр тутмын зуршил хүртэл',
  'landing.how.sub':
    'Хэдхэн минутад эхэлнэ. Төвөгтэй тохиргоо ч хэрэггүй, дэлгэц ширтэх ч шаардлагагүй.',
  'landing.how.item1.title': 'Хэлээ сонгох',
  'landing.how.item1.text':
    'Бэлэн багцаас эхлэх эсвэл өөрийн үгийн багцдаа хэл сонгоорой.',
  'landing.how.item2.title': 'Сонсох горимоо тохируулах',
  'landing.how.item2.text':
    'Үгээ сонгож, хурд болон давталтын тоогоо тохируулаад сонсоорой.',
  'landing.how.item3.title': 'Сонсоод, тогтоогоорой',
  'landing.how.item3.text':
    'Гар чөлөөтэй дадлагажиж, хэцүү үгээ дахин давтаж, ахицаа хугацааны турш хянаж байгаарай.',

  // Demo
  'landing.demo.kicker': 'Шууд туршаад үзээрэй',
  'landing.demo.title': 'Бүртгүүлэхээсээ өмнө 5 үгтэй хичээл сонсоод үзээрэй',
  'landing.demo.body':
    'Энэ туршилтын хичээл таны төхөөрөмжид суусан хоолойг ашиглана. Хэлээ сонгож, хурдаа тохируулаад үг → орчуулга → үг гэсэн дарааллаар сонсоорой.',
  'landing.demo.note':
    'Хоолойн чанар, боломж нь таны төхөөрөмж, хөтөч болон суулгасан хэлний багцаас хамаарна.',
  'landing.demo.sampleLegend': 'Турших хэл',
  'landing.demo.idle': '5 үгтэй туршилтын хичээл сонсоход бэлэн.',
  'landing.demo.stopped': 'Хичээлийг зогсоов. Үг сонгоод, эсвэл дахин тоглуулаарай.',
  'landing.demo.unsupported':
    'Энэ хөтөч дуугаар унших боломжийг дэмжихгүй байна. Шинэ хувилбарын Edge, Chrome эсвэл Safari-г туршаарай.',
  'landing.demo.playing': '{language} хэлний 5 үгтэй туршилт тоглож байна.',
  'landing.demo.complete': 'Давталт дууслаа. Дахин тоглуулах эсвэл өөр хэл туршаарай.',
  'landing.demo.voiceError':
    'Энэ хоолой ажилласангүй. Хэлний хоолойг төхөөрөмждөө суулгах эсвэл өөр хэл сонгоорой.',
  'landing.demo.selected': '{language} сонгогдлоо. Таван үг тоглуулахад бэлэн.',
  'landing.demo.phraseAria': '{current}/{total} дахь үг',
  'landing.demo.phraseLabel': '{current}/{total} дахь үг',
  'landing.demo.prevAria': 'Өмнөх үг',
  'landing.demo.nextAria': 'Дараах үг',
  'landing.demo.speedAria': 'Тоглуулах хурд',
  'landing.demo.normal': 'Хэвийн',
  'landing.demo.slow': 'Удаан',
  'landing.demo.stop': 'Зогсоох',
  'landing.demo.playLesson': '5 үгтэй хичээлийг тоглуулах',

  // Features
  'landing.features.kicker': 'Яагаад AudioRepeat',
  'landing.features.title': 'Тогтооход туслах аудио дасгал',
  'landing.features.sub':
    'Нэг энгийн санаа бий: сонсож давтах нь үгийг тогтооход тусалдаг.',
  'landing.features.item1.title': 'Ухаалаг давталт',
  'landing.features.item1.text':
    'Үгс хэрэгтэй үедээ дахин гарч ирнэ. Сонсож, өөрийгөө шалгаад, аажмаар тогтооно.',
  'landing.features.item2.title': 'Офлайн аудио тоглогч',
  'landing.features.item2.text':
    'Багцаа татаж аваад хаанаас ч дадлагажуулаарай. Онгоц, галт тэрэг, метро — дохиогүй ч саадгүй.',
  'landing.features.item3.title': 'Дуудлагаа давтах',
  'landing.features.item3.text':
    'Үгээ сонсож, хурдаа удаашруулж, давтаад дагаж хэлээрэй.',
  'landing.features.item4.title': 'Бэлэн үгийн багцууд',
  'landing.features.item4.text':
    'Олон хэлний A1-ээс C2 хүртэлх бэлэн үгийн багцууд.',

  // Languages section
  'landing.languages.titlePrefix': '{count} хэл.',
  'landing.languages.titleAccent': 'Нэг даралтаар.',
  'landing.languages.sub':
    'Арабаас Зулу хүртэл — тохирох хоолой, бэлэн үгийн багц, төвөггүй эхлэл.',
  'landing.languages.more': '+ {count} бусад',

  // Install section
  'landing.install.kicker': 'Суулгах боломжтой вэб апп',
  'landing.install.title': 'AudioRepeat-г үргэлж ойр байлгаарай',
  'landing.install.body':
    'Хөтчөөсөө суулгавал бүтэн дэлгэцийн туршлагатай болно. Татаж авсан үгс дэмжигдсэн офлайн дадлагад бэлэн хэвээр — апп дэлгүүрийн данс шаардлагагүй.',
  'landing.install.bullet1': 'Үндсэн дэлгэцээс шууд нээх',
  'landing.install.bullet2': 'Офлайн бэлэн багцууд',
  'landing.install.bullet3': 'Гар чөлөөтэй сонсох',
  'landing.install.openWithout': 'Суулгалгүй шууд нээх',

  // Pricing
  'landing.pricing.kicker': 'Үнэ',
  'landing.pricing.title': 'Өөрийн хэмнэлээр сур, өөрт тохирох эрхээ сонго',
  'landing.pricing.billingAria': 'Pro-гийн төлбөрийн хугацаа',
  'landing.pricing.monthly': 'Сар бүр',
  'landing.pricing.annual': 'Жил бүр',
  'landing.pricing.save': '{percent}% хэмнэ',
  'landing.pricing.mostPopular': 'Хамгийн эрэлттэй',

  // Plan card copy
  'landing.plan.basic.tagline': 'Сонирхогч эхлэгчдэд',
  'landing.plan.pro.tagline': 'Бүрэн сургалтын хөдөлгүүр',
  'landing.plan.lifetime.tagline': 'Нэг удаа төлөөд, үүрд ашигла',
  'landing.plan.basic.cta': 'Үнэгүй эхлэх',
  'landing.plan.pro.cta': 'Pro болох',
  'landing.plan.lifetime.cta': 'Lifetime авах',

  // Plan feature bullets + price notes
  'landing.plan.bullet.activeLanguage': '{limit} идэвхтэй хэл',
  'landing.plan.bullet.standardTts': 'Стандарт TTS дуу хоолой',
  'landing.plan.bullet.dailyWords': 'Өдөрт {limit} үг',
  'landing.plan.bullet.allLanguages': 'Бүх {count} хэл',
  'landing.plan.bullet.pronunciation': 'Хэлцварны дадлагын хэрэгслүүд',
  'landing.plan.bullet.offlinePacks': 'Офлайн аудио багцууд',
  'landing.plan.bullet.spacedQuiz': 'Интервал давталт + тестийн горим',
  'landing.plan.bullet.speedStats': 'Хурдны сорил, статистик',
  'landing.plan.bullet.everythingInPro': 'Pro-ны бүх давуу эрх',
  'landing.plan.bullet.futureLanguages': 'Ирээдүйн шинэ хэлнүүд багтана',
  'landing.plan.bullet.prioritySupport': 'Түргэн тусламж үйлчилгээ',
  'landing.plan.note.foreverFree': 'Үнэгүй',
  'landing.plan.note.perYear': '/ жил',
  'landing.plan.note.perMonth': '/ сар',
  'landing.plan.note.oneTime': 'Нэг удаагийн төлбөр',

  // Audio transparency
  'landing.audio.kicker': 'Хоолой хэрхэн ажилладаг вэ?',
  'landing.audio.title': 'Хоолойг таны төхөөрөмж гаргана',
  'landing.audio.body':
    'AudioRepeat нь таны хөтөч, үйлдлийн системд байгаа хоолойг ашигладаг. Хүний бичлэг мэтээр дүр эсгэдэггүй.',
  'landing.audio.card1.title': 'Төхөөрөмжийн хоолойг түрүүлж ашиглана',
  'landing.audio.card1.text':
    'Тохирох хоолой суусан бол AudioRepeat найдвартай тоглуулахын тулд түүнийг сонгоно.',
  'landing.audio.card2.title': 'Давталтыг та удирдана',
  'landing.audio.card2.text':
    'Дадлаж буй үгэндээ тааруулж хурд, давталт, дарааллыг өөрчилөөрэй.',
  'landing.audio.card3.title': 'Ил тод, бодитой',
  'landing.audio.card3.text':
    'Байхгүй бичлэгийг бодит мэт харагдуулахын тулд нэр, зураг, сэтгэгдэл ашигладаггүй.',

  // FAQ
  'landing.faq.kicker': 'Асуулт ба хариулт',
  'landing.faq.title': 'Эхлэхээсээ өмнө мэдэж аваарай',
  'landing.faq.sub': 'Төлөвлөгөө, дуу хоолой, офлайн ажиллагаа, төлбөрийн талаар тодорхой хариулт.',
  'landing.faq.q1': 'Үнэгүй төлөвлөгөөнд юу хийж болох вэ?',
  'landing.faq.a1':
    'Стандарт төхөөрөмжийн хоолойгоор нэг идэвхтэй хэл дээр өдөрт 300 үг хүртэл дадлагажиж болно. Бүх хэл, бүрэн хэрэгслүүд хэрэгтэй болсон даруй Pro руу шинэчилж болно.',
  'landing.faq.q2': 'AudioRepeat офлайн ажиллана уу?',
  'landing.faq.a2':
    'Тийм. Татаж авсан үгийн багцаараа офлайнаар ч дадлага хийж болно. Харин хоолой нь таны төхөөрөмжид суусан эсэхээс хамаарна.',
  'landing.faq.q3': 'Хоолойнууд хүний бичлэг үү, AI хоолой уу?',
  'landing.faq.a3':
    'AudioRepeat нь таны төхөөрөмжид байгаа хоолойг ашигладаг. Чанар, боломж нь хөтөч, үйлдлийн систем, суулгасан хэлний багцаас хамаарна.',
  'landing.faq.q4': 'Ямар төхөөрөмж дэмжигдэх вэ?',
  'landing.faq.a4':
    'AudioRepeat нь утас, планшет, компьютер дээрх орчин үеийн хөтчүүдэд ажилладаг. Дэмжигдсэн төхөөрөмж дээр хөтчөөсөө үндсэн дэлгэцийн апп болгон суулгаж болно.',
  'landing.faq.q5': 'Pro-гоо цуцлах боломжтой юу?',
  'landing.faq.a5':
    'Тийм ээ. Pro захиалгыг төлбөр удирдах горимоор цуцалж болно. Аль хэдийн төлсөн хугацаандаа эрхээ ашиглах боломжтой хэвээр үлдэнэ.',
  'landing.faq.q6': 'Lifetime юуг багтаах вэ?',
  'landing.faq.a6':
    'Lifetime бол Pro-ны бүх функцийг нэг удаагийн төлбөрөөр олгодог багц бөгөөд төлөвлөгөөнд дурдсан ирээдүйн дэмжигдсэн хэлнүүд багтана. Давтамжтай захиалга биш.',
  'landing.faq.q7': 'Мөнгө буцаалт хэрхэн ажилладаг вэ?',
  'landing.faq.a7':
    'Мөнгө буцаах нөхцөл нь худалдан авалт болон хугацаанаас хамаарна. Мөнгө буцаах бодлогыг үзэх эсвэл төлбөрийн мэдээллээ хавсаргаад тусламж үйлчилгээ рүү бичээрэй.',
  'landing.faq.helpPrefix': 'Өөр тусламж хэрэгтэй юу?',
  'landing.faq.contactSupport': 'Support руу хандах',

  // Footer
  'landing.footer.blurb':
    'Чихээр сурах хүмүүст зориулсан {count} хэлний гар чөлөөтэй аудио дадлага.',
  'landing.footer.product': 'Бүтээгдэхүүн',
  'landing.footer.howItWorks': 'Хэрхэн ажилладаг',
  'landing.footer.audioDemo': 'Дуут туршилт',
  'landing.footer.pricing': 'Үнэ',
  'landing.footer.faq': 'Асуулт ба хариулт',
  'landing.footer.contactSupport': 'Support',
  'landing.footer.newsletter': 'Мэдээнд бүртгүүлэх',
  'landing.footer.newsletterBlurb': '7 хоног тутмын хэл сургах зөвлөгөө, спамгүй.',
  'landing.footer.copyright': '© 2026 AudioRepeat · Сонсож, давтаж, санана.',
  'landing.footer.install': 'Суулгах',
  'landing.footer.practice': 'Дадлага',
  'landing.footer.privacy': 'Нууцлалын бодлого',
  'landing.footer.terms': 'Нөхцөл',
  'landing.footer.refunds': 'Мөнгө буцаах бодлого',
  'landing.footer.support': 'Support',

  // Newsletter form
  'landing.newsletter.emailRequired': 'Имэйл хаягаа оруулна уу.',
  'landing.newsletter.emailInvalid': 'Энэ нь зөв имэйл хаяг мэт санагдахгүй байна.',
  'landing.newsletter.error': 'Ямар нэгэн алдаа гарлаа, дахин оролдоно уу.',
  'landing.newsletter.success': 'Бүртгэгдлээ — имэйлээ шалгана уу.',
  'landing.newsletter.placeholder': 'you@example.com…',
  'landing.newsletter.emailAria': 'Мэдээний имэйл хаяг',
  'landing.newsletter.subscribeAria': 'Мэдээнд бүртгүүлэх',
  'landing.newsletter.subscribingAria': 'Бүртгэж байна',
};
