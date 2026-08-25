/**
 * Монгол strings for the checkout area. Trustworthy, simple tone; short
 * button labels without trailing periods; placeholders preserved.
 */
import type { CheckoutKeys } from '../en/checkout';

export const checkoutMn: Record<CheckoutKeys, string> = {
  // CheckoutFlow
  'checkout.canceled': 'Төлбөрийн ажиллагаа цуцлагдлаа — танд юу ч тооцогдоогүй.',
  'checkout.nav.practice': 'Дадлага',
  'checkout.kicker': 'Төлбөр',
  'checkout.choosePlan': 'Өөрт тохирох эрхээ сонгоорой',
  'checkout.subtitle.paddle':
    'Эрхээ сонгоод хураангуйгаа шалгаарай. Дараагийн алхамд Paddle-ээр аюулгүй төлнө.',
  'checkout.subtitle.soon':
    'Төлөвлөгөөгөө сонгоод хураангуйг харна уу — төлбөр удахгүй нээгдэнэ, өнөөдөр юу ч төлөгдөхгүй.',
  'checkout.billing.monthly': 'Сар бүр',
  'checkout.billing.annual': 'Жил бүр',
  'checkout.savePercent': '{percent}% хэмнэнэ',
  'checkout.mostPopular': 'Хамгийн эрэлттэй',
  'checkout.continueWith': '{plan} төлөвлөгөөгөөр үргэлжлүүлэх — ${price}',
  'checkout.footer.secure': 'Аюулгүй төлбөрийг Paddle гүйцэтгэнэ',
  'checkout.footer.soon': 'Өнөөдөр төлбөр авахгүй · төлбөр удахгүй',
  'checkout.backToPlans': 'Төлөвлөгөө рүү буцах',
  'checkout.signInGate.title': 'Төлбөрөө үргэлжлүүлэхийн тулд нэвтэрнэ үү',
  'checkout.signInGate.selectedPrefix': 'Та',
  'checkout.signInGate.selectedSuffix': 'төлөвлөгөөг сонгосон (${price}{note}).',
  'checkout.signInGate.needAccount':
    'Худалдан авалтыг таны бүртгэлтэй холбохын тулд нэвтрэх хэрэгтэй. Эсвэл Үнэгүй эрхээр үргэлжлүүлж болно.',
  'checkout.signInGate.needAccountSoon':
    'Төлбөр нээгдэхэд худалдан авалтыг холбох данс хэрэгтэй — одоохондоо бүх зүйлийг үнэгүй ашиглаж болно.',
  'checkout.signInCta': 'Нэвтрэх / Бүртгүүлэх',
  'checkout.continueFree': 'Үнэгүйгээр үргэлжлүүлэх',

  // PaymentStep
  'checkout.summary.title': 'Таны төлөвлөгөө',
  'checkout.billing.line.annual': 'Жил бүрийн төлбөр',
  'checkout.billing.line.monthly': 'Сар бүрийн төлбөр',
  'checkout.pay.opening': 'Аюулгүй төлбөрийг нээж байна…',
  'checkout.pay.amount': 'Paddle-ээр аюулгүй төлөх — ${price}',
  'checkout.pay.error':
    'Төлбөрийг эхлүүлж чадсангүй — дахин оролдоно уу. Paddle-ийн хуудсан дээр төлбөрөө дуусгаагүй бол танд юу ч тооцогдохгүй.',
  'checkout.pay.securityNote':
    '🔒 Аюулгүй төлбөрийг Paddle гүйцэтгэнэ — картын мэдээлэл AudioRepeat-д огт хүрдэггүй.',
  'checkout.basic.title': '🎉 Basic төлөвлөгөө үнэгүй — төлбөр шаардлагагүй',
  'checkout.basic.body':
    'Basic эрхээ шууд ашиглаж эхлээрэй. Хэрэгцээ нэмэгдвэл дараа нь Pro эсвэл Lifetime руу шилжиж болно.',
  'checkout.soon.title': '💳 Төлбөрийн систем удахгүй',
  'checkout.soon.body':
    'AudioRepeat одоогоор төлбөр авахгүй байна. Төлбөрийн систем нээгдсэний дараа эндээс төлнө. Өнөөдөр танд юу ч тооцогдохгүй.',
  'checkout.notify.idle': 'Төлбөр нээгдэхэд надад мэдэгдээрэй',
  'checkout.notify.done': '✓ Баярлалаа — төлбөр нээгдэхэд бид танд мэдэгдье',
  'checkout.notify.error':
    'Одоо хадгалж чадсангүй — асуудалгүй, одоохондоо бүх зүйл үнэгүй байна.',
  'checkout.changePlan': 'Багцаа солих',

  // SuccessView
  'checkout.word.plan': 'төлөвлөгөө',
  'checkout.success.welcome': '{plan} эрх идэвхжлээ!',
  'checkout.success.active.monthly': 'Таны {plan} төлөвлөгөө идэвхтэй (сар бүрийн төлбөр)',
  'checkout.success.active.annual': 'Таны {plan} төлөвлөгөө идэвхтэй (жил бүрийн төлбөр)',
  'checkout.success.active.lifetime': 'Таны {plan} төлөвлөгөө идэвхтэй',
  'checkout.success.receipt': 'Төлбөрийн баримтыг {email} хаяг руу илгээж байна.',
  'checkout.success.startCta': 'Дадлаж эхлэх',
  'checkout.success.verifying': 'Таны багцыг баталгаажуулж байна…',
  'checkout.success.activating': 'Төлбөр баталгаажлаа — эрхийг идэвхжүүлж байна',
  'checkout.success.verifyingBody':
    'Таны {plan} төлөвлөгөөг төлбөрийн провайдертайгаа баталгаажуулж байна.',
  'checkout.success.activatingBody':
    'Таны төлбөр илгээгдлээ. Эрх идэвхжихэд ихэвчлэн хэдхэн секунд л орно. Pro функцүүд бага зэрэг хоцорч нээгдэж болно.',
  'checkout.success.goDashboard': 'Дашборд руу очих',
  'checkout.success.checkAgain': 'Дахин шалгах',
  'checkout.success.pendingTimeout': 'Таны төлөвлөгөө одоогоор баталгаажаагүй байна',
  'checkout.success.submitted': 'Таны төлбөр илгээгдсэн',
  'checkout.success.timeoutBody':
    'Төлбөрийг дуусгасан бол харагдахад бага зэргийн хугацаа орж болно. Баталгаажих хүртэл бүх зүйл үнэгүй хэвээр — танд буруугаар юу ч тооцогдоогүй.',
  'checkout.success.pendingBody':
    'Төлөвлөгөө идэвхжихийг хүлээж байна — ихэвчлэн хэдхэн секунд л болно.',
  'checkout.success.thanksTitle': 'Захиалгад баярлалаа',
  'checkout.success.unverifiedBody':
    'Энэ дэлгэцэнд таны төлөвлөгөөг баталгаажуулж чадсангүй, гэхдээ төлбөр хийсэн бол харагдахад бага зэрэг хугацаа орж болно. Баталгаажих хүртэл бүх зүйл үнэгүй хэвээр.',

  // DowngradeModal
  'checkout.downgrade.aria': 'Үнэгүй төлөвлөгөө рүү шилжих',
  'checkout.downgrade.title': 'Үнэгүй эрх рүү шилжих',
  'checkout.downgrade.doneTitle': 'Үнэгүй эрх идэвхтэй',
  'checkout.downgrade.keptPrefix': 'Хадгалж үлдэх хэл:',
  'checkout.downgrade.hiddenLangs.one': 'бусад 1 хэл нуугдлаа',
  'checkout.downgrade.hiddenLangs.other': 'бусад {count} хэл нуугдлаа',
  'checkout.downgrade.setsWrap': ' ({sets})',
  'checkout.downgrade.hiddenNote':
    ' — юу ч устахгүй. Дараа нь Pro-д шилжвэл дахин харагдана.',
  'checkout.downgrade.nothingHidden': 'Юу ч нуугдаагүй.',
  'checkout.downgrade.withinLimit.title': 'Хязгаарын дотор байна',
  'checkout.downgrade.withinLimit.body.one':
    'Таны сан аль хэдийн нэг хэлтэй тул нуух зүйл байхгүй. Үнэгүй төлөвлөгөөнд {limit} идэвхтэй хэл багтана.',
  'checkout.downgrade.withinLimit.body.other':
    'Таны сан аль хэдийн нэг хэлтэй тул нуух зүйл байхгүй. Үнэгүй төлөвлөгөөнд {limit} идэвхтэй хэл багтана.',
  'checkout.downgrade.intro.one': 'Үнэгүй төлөвлөгөөнд {limit} идэвхтэй хэл багтана',
  'checkout.downgrade.intro.other': 'Үнэгүй төлөвлөгөөнд {limit} идэвхтэй хэл багтана',
  'checkout.downgrade.introMiddle': '. Хадгалах хэлээ сонгоно уу — бусад хэлийн багцууд',
  'checkout.downgrade.hiddenBold': 'нуугдана, устгагдахгүй',
  'checkout.downgrade.introSuffix': ', дараа шинэчлэвэл автомат буцна.',
  'checkout.downgrade.langMeta': '{sets} · {words}',
  'checkout.downgrade.sets.one': '{count} багц',
  'checkout.downgrade.sets.other': '{count} багц',
  'checkout.downgrade.keepPrefix': 'Хадгалах:',
  'checkout.downgrade.keepSuffix.one':
    'үлдээвэл өөр {count} хэл ({sets}) нуугдана. Тасралтгүй өдөр, статистик, үгийн эзэмшил бүгд хадгалагдана.',
  'checkout.downgrade.keepSuffix.other':
    'үлдээвэл өөр {count} хэл ({sets}) нуугдана. Тасралтгүй өдөр, статистик, үгийн эзэмшил бүгд хадгалагдана.',
  'checkout.downgrade.selectPrompt': 'Үргэлжлүүлэхийн тулд хэл сонгоно уу.',
  'checkout.downgrade.confirmCta': 'Батлан Үнэгүй рүү шилжих',
};
