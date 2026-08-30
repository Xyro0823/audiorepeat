import type { StatsKeys } from '../en/stats';

// Mongolian strings for the stats area. Keys/placeholders must mirror
// en/stats.ts exactly (compile-checked by Record<StatsKeys, string>).
export const statsMn: Record<StatsKeys, string> = {
  // ---- Pro түгжээний дэлгэц ----
  'stats.lock.title': 'Дадлагын статистик',
  'stats.lock.body':
    'Тасралтгүй өдрийн түүх, идэвхийн зураглал, үгийн ахиц нь Pro эрхэд багтана. Сонсох болон диктантын дасгалаа Үнэгүй эрхээр үргэлжлүүлж болно.',

  // ---- Толгой хэсэг ----
  'stats.backAria': 'Сан руу буцах',
  'stats.library': 'Сан',
  'stats.title': 'Статистик',

  // ---- Тасралтгүй өдрийн толь ----
  'stats.dayStreak': 'тасралтгүй өдөр',
  'stats.streakSummary': 'Дээд амжилт: {best} хоног · {active} идэвхтэй өдөр',

  // ---- Хугацааны самбарууд ('Өнөөдөр' нь common.today-г ашиглана) ----
  'stats.period.allTime': 'Нийт хугацаанд',
  'stats.metric.wordsListened': 'сонссон үг',
  'stats.metric.studyTime': 'дадлагын хугацаа',

  // ---- Хоосон төлөв ----
  'stats.empty.title': 'Одоогоор дадлага алга',
  'stats.empty.body':
    'Багцаа тоглуулаад дадлага хийж эхлээрэй. Таны ахиц, статистик энд харагдана.',
  'stats.empty.backLibrary': 'Сан руу буцах',

  // ---- Хэсгүүд ----
  'stats.week.title': 'Энэ долоо хоног',
  'stats.month.title': 'Сүүлийн 30 хоног',
  'stats.month.activeDays': '{count} идэвхтэй өдөр',
  'stats.legend.less': 'бага',
  'stats.legend.more': 'их',
  'stats.weekly.title': 'Сүүлийн 8 долоо хоног',
  'stats.weekly.sub': 'долоо хоног бүрт сонссон үг',
  'stats.weekly.barTitle': '{label}-оос эхэлсэн 7 хоног — {words} үг · {time}',

  // ---- Дулааны зургийн нүдний tooltip (ActivityHeatmap) ----
  'stats.heatmap.cellNone': '{head} — дадлага алга',
  'stats.heatmap.cellOne': '{head} — {count} үг · {time}',
  'stats.heatmap.cellMany': '{head} — {count} үг · {time}',

  // ---- StreakBadge гарчигууд ----
  'stats.badge.activeTitle': '{count} хоног тасралтгүй дадлага',
  'stats.badge.inactiveTitle': 'Одоогоор цуврал алга — өнөөдөр богинохон дадлага хийгээрэй',
};
