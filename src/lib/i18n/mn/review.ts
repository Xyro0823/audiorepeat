import type { ReviewKeys } from '../en/review';

// Mongolian strings for the review area. Keys/placeholders must mirror
// en/review.ts exactly (compile-checked by Record<ReviewKeys, string>).
export const reviewMn: Record<ReviewKeys, string> = {
  // ---- Pro түгжээний дэлгэц ----
  'review.lock.title': 'Интервал давталт',
  'review.lock.body':
    'FSRS-ийн товлолт, давталтын хэсэг, үгийг Мэддэг/Давтах гэж тэмдэглэх нь Pro-ны давуу эрх. Сонсох болон диктантын дадлагаа Үнэгүй төлөвлөгөөрөө үргэлжлүүлээрэй.',

  // ---- Давтах зүйл байхгүй төлөв ----
  'review.empty.eyebrow': 'Өнөөдөр давтах',
  'review.empty.title': 'Одоогоор давтах үг алга',
  'review.empty.body':
    'Сонсохдоо хэцүү үгсийг Давтах гэж тэмдэглээрэй. Мэддэг үгс цаг хугацааны явцад энэ дараалалд эргэн орно.',
  'review.backToDashboard': 'Дашборд руу буцах',

  // ---- Давталт дууссан төлөв ----
  'review.done.eyebrow': 'Давталт дууслаа',
  'review.done.title': '{count} үг бэхжигсэн',
  'review.done.body':
    'FSRS үг бүрийг дахин хэрэгтэй болох хамгийн тохиромжтой мөчид нь товлосон байна.',

  // ---- Давталтын толгой ----
  'review.dashboardCrumb': '← Дашборд',
  'review.header.title': 'Өнөөдөр давтах',
  'review.timeLeft': 'ойролцоогоор {minutes} минут үлдсэн',

  // ---- Үгний картны үйлдлүүд ----
  'review.hearWord': 'Үгийг сонсох',
  'review.speaking': 'Уншиж байна…',
  'review.showAnswer': 'Хариултыг харах',

  // ---- Клауд хоолойн зөвшөөрөл ----
  'review.cloud.title': 'Клауд хоолой шаардлагатай',
  'review.cloud.body':
    'Энэ төхөөрөмж энэ хэлэнд хоолойгүй байна. Дуудаад буй үг л Microsoft Azure руу илгээгдэнэ.',
  'review.cloud.enable': 'Клауд хоолойг идэвхжүүлэх',
  'review.cloud.enableSignIn': 'Нэвтэрч клауд хоолойг идэвхжүүлэх',

  // ---- Үнэлгээний товчнууд ----
  'review.rate.prompt': 'Хэр сайн сансан бэ?',
  'review.rate.again': 'Дахин',
  'review.rate.againHint': '< 1 өдөр',
  'review.rate.review': 'Давтах',
  'review.rate.soonHint': 'Удахгүй',
  'review.rate.known': 'Мэддэг',
  'review.rate.laterHint': 'Хожуу',

  // ---- Алдаа ----
  'review.error.saveFailed': 'Энэ давталтыг хадгалж чадсангүй. Үнэлгээг дахин өгнө үү.',
};
