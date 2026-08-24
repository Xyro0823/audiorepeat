import type { ChallengeKeys } from '../en/challenge';

// Mongolian strings for the speed challenge. Keys/placeholders must mirror
// en/challenge.ts exactly (compile-checked by Record<ChallengeKeys, string>).
export const challengeMn: Record<ChallengeKeys, string> = {
  // ---- Эхлэл дэлгэц ----
  'challenge.intro.title': '1 минутын сорил',
  'challenge.intro.setMeta': '{name} · {count} үг',
  'challenge.intro.description':
    'Үг бүрийг сонсоод, орчуулгыг нь аль болох хурдан олоорой — {seconds} секундэд хэдийг зөв хариулж чадах вэ?',
  'challenge.intro.personalBest.one': '⚡ Дээд амжилт: {score} · {plays} тоглолт',
  'challenge.intro.personalBest.other': '⚡ Дээд амжилт: {score} · {plays} тоглолт',
  'challenge.intro.start': '▶ Эхлэх',

  // ---- Тоглож буй дэлгэц ----
  'challenge.playing.timer': '{seconds} сек',
  'challenge.playing.score': 'Оноо',
  'challenge.playing.exitAria': 'Сорилтоос гарах',
  'challenge.playing.exitTitle': 'Гарах — энэ удаадын оноо хадгалахгүй',
  'challenge.playing.pickTranslation': '{index} · орчуулгыг нь ол',
  'challenge.playing.replayWord': 'Үгийг дахин тоглуулах',

  // ---- Хариултын хариу мэдэгдэл ----
  'challenge.answer.correct': '✓ Зөв!',
  'challenge.answer.wasAnswer': '✗ Зөв нь "{answer}" байсан',

  // ---- Дуусах дэлгэц ----
  'challenge.finish.title': 'Хугацаа дууслаа!',
  'challenge.finish.subtitle': '{seconds} секундын дотор зөв',
  'challenge.finish.newBest': '🏆 Шинэ дээд амжилт!',
  'challenge.finish.best.one': 'Дээд амжилт: {score} · {plays} тоглолт',
  'challenge.finish.best.other': 'Дээд амжилт: {score} · {plays} тоглолт',
  'challenge.finish.playAgain': '↻ Дахин тоглох',
};
