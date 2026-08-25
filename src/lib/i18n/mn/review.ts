import type { ReviewKeys } from '../en/review';

// Mongolian strings for the review area. Keys/placeholders must mirror
// en/review.ts exactly (compile-checked by Record<ReviewKeys, string>).
export const reviewMn: Record<ReviewKeys, string> = {
  // ---- Pro түгжээний дэлгэц ----
  'review.lock.title': 'Интервал давталт',
  'review.lock.body':
    'Ухаалаг давталтын хуваарь, давтлагын хэсэг, Мэддэг/Давтах тэмдэглэгээ нь Pro эрхэд багтана. Харин сонсох болон диктантын дасгалаа Үнэгүй эрхээрээ үргэлжлүүлж болно.',

  // ---- Давтах зүйл байхгүй төлөв ----
  'review.empty.eyebrow': 'Өнөөдөр давтах',
  'review.empty.title': 'Одоогоор давтах үг алга',
  'review.empty.body':
    'Сонсохдоо хэцүү санагдсан үгээ Давтах гэж тэмдэглээрэй. Мэддэг үгс ч тохирох үедээ энэ дараалалд дахин орж ирнэ.',
  'review.backToDashboard': 'Дашборд руу буцах',

  // ---- Давталт дууссан төлөв ----
  'review.done.eyebrow': 'Давталт дууслаа',
  'review.done.title': '{count} үг давтагдлаа',
  'review.done.body':
    'Үг бүрийг дараагийн удаа хэзээ давтах нь автоматаар товлогдлоо.',

  // ---- Давталтын толгой ----
  'review.dashboardCrumb': '← Дашборд',
  'review.header.title': 'Өнөөдөр давтах',
  'review.timeLeft': 'ойролцоогоор {minutes} минут үлдлээ',

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
  'review.rate.laterHint': 'Дараа',

  // ---- Алдаа ----
  'review.error.saveFailed': 'Энэ давталтыг хадгалж чадсангүй. Үнэлгээг дахин өгнө үү.',
};
