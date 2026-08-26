/**
 * Монгол strings for the dashboard area. Natural phrasing over literal
 * translation; placeholders ({count}, {minutes}, {time}…) are preserved.
 */
import type { DashboardKeys } from '../en/dashboard';

export const dashboardMn: Record<DashboardKeys, string> = {
  // WelcomeHero
  'dashboard.welcome.back': 'Тавтай морилно уу',
  'dashboard.welcome.title': 'Сонсож сурахад бэлэн үү?',
  'dashboard.welcome.subtitle':
    'Гараа чөлөөлөөд үгээ давтаарай. Өнөөдрийн богино дадлага таны цувралыг үргэлжлүүлнэ.',
  'dashboard.welcome.startLearning': 'Сурч эхлэх',
  'dashboard.chips.wordsToday.one': 'Өнөөдөр {count} үг',
  'dashboard.chips.wordsToday.other': 'Өнөөдөр {count} үг',
  'dashboard.chips.studied': '{time} дадлага хийсэн',
  'dashboard.chips.streakStart': 'Тасралтгүй өдрөө эхлүүлэх',

  // MobileDashboardNav
  'dashboard.mobileNav.aria': 'Дашбордын цэс',
  'dashboard.mobileNav.home': 'Эхлэл',
  'dashboard.mobileNav.review': 'Давтах',
  'dashboard.mobileNav.resume': 'Үргэлжлүүлэх',
  'dashboard.mobileNav.library': 'Сан',
  'dashboard.mobileNav.settings': 'Тохиргоо',

  // Streak day counts (hero chip + metrics card)
  'dashboard.streakDays.one': '{count} өдөр',
  'dashboard.streakDays.other': '{count} өдөр',

  // ReviewTodayCard
  'dashboard.review.memoryQueue': 'Давтлагын дараалал',
  'dashboard.reviewToday': 'Өнөөдөр давтах',
  'dashboard.review.due.one': '{count} үг · ойролцоогоор {minutes} минут',
  'dashboard.review.due.other': '{count} үг · ойролцоогоор {minutes} минут',
  'dashboard.review.caughtUp':
    'Давтах зүйл байхгүй байна. Сонсохдоо хэцүү үгээ Давтах гэж тэмдэглээрэй.',
  'dashboard.review.start': 'Давтаж эхлэх',
  'dashboard.reminder.title': 'Өдөр тутмын сануулга',
  'dashboard.reminder.timeAria': 'Өдөр тутмын сануулгын цаг',
  'dashboard.reminder.on': 'Идэвхтэй',
  'dashboard.reminder.enable': 'Идэвхжүүлэх',
  'dashboard.reminder.next': 'Дараагийн сануулга: {time}',
  'dashboard.reminder.hint': 'Энэ цагт давтах үгс тань бэлэн болно.',
  'dashboard.reminder.msg.off': 'Өдөр тутмын сануулга унтраагдлаа.',
  'dashboard.reminder.msg.needPwa':
    'Сануулга ашиглахын тулд аппыг мэдэгдэл дэмждэг хөтөч дээр суулгаарай.',
  'dashboard.reminder.msg.blocked':
    'Мэдэгдэл хаалттай байна. Хөтчийнхөө тохиргооноос зөвшөөрөөрэй.',
  'dashboard.reminder.msg.set': 'Өдөр тутмын сануулга {time}-д тохируулагдлаа.',

  // Next-due guidance (0-due state on ReviewTodayCard + review screens)
  'dashboard.review.nextDue.today': 'Дараагийн үг өнөөдөр дотор давтахад бэлэн болно.',
  'dashboard.review.nextDue.tomorrow': 'Дараагийн үг маргааш давтахад бэлэн болно.',
  'dashboard.review.nextDue.days.one': 'Дараагийн үг {count} хоногийн дараа давтахад бэлэн болно.',
  'dashboard.review.nextDue.days.other': 'Дараагийн үг {count} хоногийн дараа давтахад бэлэн болно.',
  'dashboard.review.nextDue.date': 'Дараагийн үг {date}-нд давтахад бэлэн болно.',

  // MetricCards
  'dashboard.metric.accuracy.label': 'Сонсох нарийвчлал',
  'dashboard.metric.accuracy.hint': 'Эзэмшсэн болон давтах үгс',
  'dashboard.metric.mastered.label': 'Эзэмшсэн үг',
  'dashboard.metric.mastered.hint': 'Бүх багцаар мэдсэн үг',
  'dashboard.metric.streak.label': 'Тасралтгүй өдөр',
  'dashboard.metric.streak.hint': '{days} өдрийн дадлагын зорилт',

  // CloudSyncBadge
  'dashboard.sync.title': 'Энэ санг нэвтэрсэн төхөөрөмжүүдийн хооронд синк хийх',

  // AiInsightsCard
  'dashboard.insights.title': 'Өнөөдрийн зөвлөмж',
  'dashboard.insights.subtitle': 'Дараагийн хийх зүйлс',
  'dashboard.insights.goalLabel': 'Өдөр тутмын аудио зорилт',
  'dashboard.insights.review.some.one': 'Өнөөдөр {count} үг давтах хэрэгтэй',
  'dashboard.insights.review.some.other': 'Өнөөдөр {count} үг давтах хэрэгтэй',
  'dashboard.insights.review.none': 'Бүгд давтагдсан — давтах зүйл алга',
  'dashboard.insights.review.meta.some': 'Давтаж эхлээд, хэрэгтэй үгсээ сонгоорой',
  'dashboard.insights.review.meta.none': 'Маш сайн!',
  'dashboard.insights.goal.done': 'Өдөр тутмын аудио зорилт биеллээ',
  'dashboard.insights.goal.progress': 'Өдөр тутмын аудио зорилтын {pct}% биеллээ',
  'dashboard.insights.goal.meta.done': 'Гайхалтай төвлөрөлт 🎉',
  'dashboard.insights.goal.meta.left': '{pct}% үлдлээ — сонсоорой',
  'dashboard.insights.streak.some': '{days} өдөр дараалан дадлага хийжээ — үргэлжлүүлээрэй',
  'dashboard.insights.streak.none': 'Тасралтгүй өдрөө өнөөдөр эхлүүлээрэй',
  'dashboard.insights.streak.meta.some': 'Тогтмол дадлага хамгийн чухал',
  'dashboard.insights.streak.meta.none': 'Нэг богино дадлага хангалттай',

  // AiAssistantButton
  'dashboard.aiAssistant.open': 'AI туслахыг нээх',

  // GettingStartedChecklist
  'dashboard.checklist.kicker': 'Хурдан эхлэл',
  'dashboard.checklist.title': 'Анхны дадлагаа эхлэхэд бэлдээрэй',
  'dashboard.checklist.progress': '{done}/{total} алхам дууслаа',
  'dashboard.checklist.dismissAria': 'Эхлэлийн жагсаалтыг хаах',
  'dashboard.checklist.language.label': 'Хэлээ сонгоно уу',
  'dashboard.checklist.language.action': 'Сонгох',
  'dashboard.checklist.sets.label': 'Дадлагын багц нэмэх',
  'dashboard.checklist.sets.action': 'Багц үзэх',
  'dashboard.checklist.practice.label': 'Анхны давталтаа тоглуулах',
  'dashboard.checklist.practice.action': 'Дадлагажих',

  // FreePlanNotice
  'dashboard.freeNotice.prefix': 'Таны',
  'dashboard.freeNotice.includes.one': 'төлөвлөгөөнд {limit} идэвхтэй хэл багтана — ',
  'dashboard.freeNotice.includes.other': 'төлөвлөгөөнд {limit} идэвхтэй хэл багтана — ',
  'dashboard.freeNotice.more.one': 'Дараагийн 1 хэл нээхэд бэлэн байна.',
  'dashboard.freeNotice.more.other': 'Дараагийн {count} хэл нээхэд бэлэн байна.',
  'dashboard.freeNotice.total': 'нийт {count}.',
  'dashboard.freeNotice.upgrade': 'Pro руу шинэчлэх',
  'dashboard.freeNotice.dismissAria': 'Шинэчлэлийн мэдэгдлийг хаах',

  // ProFeatureLock (shared lock screen for Pro-only routes)
  'dashboard.lock.badge': 'Pro функц',
  'dashboard.lock.cta': '⭐ Pro руу шинэчлэх',
  'dashboard.lock.freeNote':
    'Үнэгүй төлөвлөгөөнд сонсох дасгал, диктант, стандарт хоолойтой нэг хэл хэвээр үлдэнэ.',
  'dashboard.lock.back': 'Дадлага руу буцах',

  // PWA install extras (InstallPrompt / InstallAppButton)

  // PWA update prompt (UpdatePrompt — waiting service worker)

  // Error boundary extra
};
