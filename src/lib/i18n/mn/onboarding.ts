/**
 * Монгол strings for the onboarding area. Friendly, natural app-Mongolian;
 * placeholders ({step}, {total}, {current}, {limit}) are preserved.
 * "Дадлагын хэл" = free language (the one included learning language).
 */
import type { OnboardingKeys } from '../en/onboarding';

export const onboardingMn: Record<OnboardingKeys, string> = {
  // OnboardingFlow хүрээ
  'onboarding.aria.title': 'AudioRepeat-д тавтай морилно уу',
  'onboarding.step.count': '{total} алхмаас {step}-р алхам',
  'onboarding.step.title.language': 'Хэлээ сонгох',
  'onboarding.step.title.level': 'Эхлэх түвшингээ сонгох',
  'onboarding.step.title.goal': 'Суралцах зорилгоо сонгох',
  'onboarding.step.title.ready': 'Бүгд бэлэн',

  // 2-р алхам — эхлэх түвшин
  'onboarding.level.heading': 'Эхлэх түвшингээ сонгоно уу',
  'onboarding.level.sub': 'Танд тохирох үгсийг бэлдэнэ. Дараа нь хүссэн үедээ сольж болно.',
  'onboarding.level.groupAria': 'Эхлэх түвшин',
  'onboarding.level.testTitle': 'Эхлэх цэгээ хурдан шалгах',
  'onboarding.level.testBody': '10 богино үгийн асуултад хариулаад хаанаас эхлэхээ санал болгуулна. Энэ нь албан ёсны CEFR шалгалт биш.',
  'onboarding.level.startTest': 'Эхлэх цэгээ шалгах',
  'onboarding.level.manualTitle': 'Эсвэл өөрөө сонгох',
  'onboarding.level.selfAssessment': 'Энэ хэлд түвшин бүрийн асуулт хангалттай болоогүй байна. Өөрт ойр түвшнээ сонгоорой — дараа нь хүссэн үедээ өөрчилж болно.',
  'onboarding.placement.loading': 'Асуултуудыг бэлдэж байна…',
  'onboarding.placement.questionCount': '{total} асуултын {current}',
  'onboarding.placement.prompt': 'Тохирох үгийг сонгоно уу',
  'onboarding.placement.answersAria': 'Хариултын сонголтууд',
  'onboarding.placement.resultKicker': 'Санал болгож буй эхлэх түвшин',
  'onboarding.placement.resultBody': 'Та {total} асуултаас {score}-д нь зөв хариуллаа. Энэ бол эхлэх санал бөгөөд дараа нь хүссэн үедээ өөрчилж болно.',
  'onboarding.placement.note': 'Энэ хурдан шалгалт нь зөвхөн үгийн санг харна. Хэдэн бодит дадлагын дараа өөрт тохирсон түвшин илүү тодорхой болно.',
  'onboarding.placement.useLevel': '{level} түвшнээс эхлэх',
  'onboarding.placement.chooseManually': 'Өөр түвшин сонгох',

  // 3-р алхам — суралцах зорилго
  'onboarding.goal.heading': 'Таны зорилго юу вэ?',
  'onboarding.goal.sub':
    'Зорилгоо сонгоорой. Дадлагын санал түүнд тань тохирно.',
  'onboarding.goal.groupAria': 'Суралцах зорилго',

  // Хамтарсан товчнууд
  'onboarding.back': '← Буцах',

  // 4-р алхам — бэлэн
  'onboarding.ready.heading': 'Бүгд бэлэн боллоо!',
  'onboarding.ready.planIntro': 'Таны эхлэх тохиргоо:',
  'onboarding.summary.language': 'Хэл',
  'onboarding.summary.startingLevel': 'Эхлэх түвшин',
  'onboarding.summary.goal': 'Зорилго',
  'onboarding.ready.recommended': 'Санал болгосон анхны дадлага',
  'onboarding.ready.startPractice': 'Санал болгосон дадлагаас эхэлье',
  'onboarding.ready.goDashboard': 'Дашборд руу очих',

  // FreeLanguagePicker
  'onboarding.freeLang.title': 'Сурах хэлээ сонгох',
  'onboarding.freeLang.subtitlePro':
    'Таны төлөвлөгөө бүх хэлийг багтаадаг — аль хэл дээр төвлөрөхөө сонгоорой.',
  'onboarding.freeLang.subtitleFree':
    'Үнэгүй төлөвлөгөөнд {limit} хэл багтана. Сурах хэлээ сонгоорой.',
  'onboarding.freeLang.included': '✓ Үнэгүй багцад багтсан',
  'onboarding.freeLang.locked': '🔒 Pro',
  'onboarding.freeLang.preferred': '✓ Сонголт',
  'onboarding.freeLang.fullPack': 'Бүрэн A1–C2 багц',
  'onboarding.freeLang.starterPack': 'Эхлэх багц',
  'onboarding.freeLang.voiceChecking': 'Төхөөрөмжийн хоолойг шалгаж байна…',
  'onboarding.freeLang.voiceReady': 'Төхөөрөмжийн хоолой бэлэн',
  'onboarding.freeLang.voiceUnavailable': 'Тохирох төхөөрөмжийн хоолой олдсонгүй',
  'onboarding.freeLang.voiceUnavailableHint': 'Үргэлжлүүлж болно. AudioRepeat таны хөтчийн хамгийн тохирох хоолойг ашиглахыг оролдоно.',

  // ChangeFreeLanguageModal
  'onboarding.changeLang.aria': 'Сурах хэлээ солих',
  'onboarding.changeLang.title': 'Сурах хэлээ солих',
  'onboarding.changeLang.body':
    'Одоогийн хэлний багцууд устахгүй, түр нуугдана. Pro-д шилжвэл дахин харагдана.',
  'onboarding.changeLang.pickerSubtitle.one':
    'Үнэгүй төлөвлөгөөнд {limit} хэл багтана. Сурах хэлээ сонгоорой — солиход бусад багцууд нуугдана (устгагдахгүй, хадгалагдана).',
  'onboarding.changeLang.pickerSubtitle.other':
    'Үнэгүй төлөвлөгөөнд {limit} хэл багтана. Сурах хэлээ сонгоорой — солиход бусад багцууд нуугдана (устгагдахгүй, хадгалагдана).',
  'onboarding.changeLang.settingUp': 'Хэлийг тохируулж байна…',

  // FreeLanguageBar
  'onboarding.bar.your': 'Таны',
  'onboarding.bar.freeLanguage': 'сурах хэл',
  'onboarding.bar.change': 'Солих',

  // FirstSessionGuide
  'onboarding.guide.firstLoop': 'Анхны давталт',
  'onboarding.guide.stepProgress': '{total} алхмын {current} дахь',
  'onboarding.guide.skipAria': 'Анхны дадлагын зааврыг алгасах',
  'onboarding.guide.skipTitle': 'Алгасах',
  'onboarding.guide.gotIt': 'Ойлголоо',
  'onboarding.guide.step1.eyebrow': 'Сонсох',
  'onboarding.guide.step1.title': 'Давталт өөрөө ажиллана',
  'onboarding.guide.step1.description':
    'Play-г нэг удаа дараарай. AudioRepeat үг, орчуулгыг ээлжлэн тоглоод өөрөө дараагийн үг рүү шилжинэ.',
  'onboarding.guide.step2.eyebrow': 'Шийдэх',
  'onboarding.guide.step2.title': 'Давтах үгээ аппд зааж өгөөрэй',
  'onboarding.guide.step2.description':
    'Амархан санагдсан үгээ Мэддэг гэж, дахин ажиллах хэрэгтэй үгээ Давтах гэж тэмдэглээрэй. Ингэвэл өдөр тутмын давтлага тань илүү хэрэгтэй болно.',
  'onboarding.guide.known': 'Мэддэг',
  'onboarding.guide.reviewSooner': 'Эхэлж давтах',
  'onboarding.guide.step3.eyebrow': 'Буцах',
  'onboarding.guide.step3.title': '“Өнөөдөр давтах” хуудастаа буцааж ирээрэй',
  'onboarding.guide.step3.description':
    'Хэцүү үгс хэрэгтэй үедээ дахин гарч ирнэ. Өдөр бүрийн богинохон дадлага ч ахицад хангалттай.',
  'onboarding.guide.nextSmartReview': 'Дараагийн ухаалаг давталт',
  'onboarding.guide.reviewToday': 'Өнөөдөр давтах',
};
