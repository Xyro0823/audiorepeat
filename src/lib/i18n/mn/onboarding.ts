/**
 * Монгол strings for the onboarding area. Friendly, natural app-Mongolian;
 * placeholders ({step}, {total}, {current}, {limit}) are preserved.
 * "Дадлагын хэл" = free language (the one included learning language).
 */
import type { OnboardingKeys } from '../en/onboarding';

export const onboardingMn: Record<OnboardingKeys, string> = {
  // OnboardingFlow хүрээ
  'onboarding.aria.title': 'AudioRepeat-д тавтай морилно уу',
  'onboarding.step.count': '{total} алхмын {step} дахь',
  'onboarding.step.title.language': 'Хэлээ сонгох',
  'onboarding.step.title.level': 'Эхлэх түвшингээ сонгох',
  'onboarding.step.title.goal': 'Суралцах зорилгоо сонгох',
  'onboarding.step.title.ready': 'Бүгд бэлэн',

  // 2-р алхам — эхлэх түвшин
  'onboarding.level.heading': 'Эхлэх түвшингээ сонгоно уу',
  'onboarding.level.sub': 'Санд чинь тохирох үгс бэлдэх болно — хожим хэзээ ч солиж болно.',
  'onboarding.level.groupAria': 'Эхлэх түвшин',

  // 3-р алхам — суралцах зорилго
  'onboarding.goal.heading': 'Таны зорилго юу вэ?',
  'onboarding.goal.sub':
    'Суралцах зорилгоо сонгоорой — дадлагыг түүнд нийцүүлэн тохируулна.',
  'onboarding.goal.groupAria': 'Суралцах зорилго',

  // Хамтарсан товчнууд
  'onboarding.back': '← Буцах',

  // 4-р алхам — бэлэн
  'onboarding.ready.heading': 'Бүгд бэлэн боллоо!',
  'onboarding.ready.planIntro': 'Таны дадлагын төлөвлөгөө:',
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

  // ChangeFreeLanguageModal
  'onboarding.changeLang.aria': 'Сурах хэлээ солих',
  'onboarding.changeLang.title': 'Сурах хэлээ солих',
  'onboarding.changeLang.body':
    'Одоогийн хэлний багцууд хадгалагдана — устгагдахгүй, зөвхөн нуугдана. Ахиулбал буцаж гарна.',
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
    'Нэг удаа Play дарж орхиорой. AudioRepeat очих үг болон орчуулгыг ээлжлэн тоглоод, гараа ч хүрэлгүй урагш шилжинэ.',
  'onboarding.guide.step2.eyebrow': 'Шийдэх',
  'onboarding.guide.step2.title': 'Давтах үгээ аппд зааж өгөөрэй',
  'onboarding.guide.step2.description':
    'Амархан санагдах үгээ Мэддэг гэж тэмдэглээрэй. Дахин давлах шаардлагатай үгийг Давтах гэж тэмдэглээрэй — ингэснээр өдрийн дараалалдаа хэрэгтэй үгсээ байлгана.',
  'onboarding.guide.known': 'Мэддэг',
  'onboarding.guide.reviewSooner': 'Эхэлж давтах',
  'onboarding.guide.step3.eyebrow': 'Буцах',
  'onboarding.guide.step3.title': '“Өнөөдөр давтах” хуудастаа буцааж ирээрэй',
  'onboarding.guide.step3.description':
    'Хэцүү үгс тань дадлага хийхэд хэрэгтэй мөчид нь дахин гарна. Өдөр бүрийн богино дадлага л хангалттай — ахиц зогсохгүй.',
  'onboarding.guide.nextSmartReview': 'Дараагийн ухаалаг давталт',
  'onboarding.guide.reviewToday': 'Өнөөдөр давтах',
};
