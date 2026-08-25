/**
 * Монгол dictionary. Must define EVERY key in `en/common.ts` — enforced by
 * `Record<CommonKeys | PwaKeys | …, string>`, so a missing key breaks `tsc`.
 * Placeholders like {name} must appear in both locales.
 */
import type { CommonKeys, ErrorKeys, PwaKeys, SyncKeys } from '../en/common';

export const commonMn: Record<CommonKeys, string> = {
  'common.save': 'Хадгалах',
  'common.saved': 'Хадгалсан',
  'common.saving': 'Хадгалж байна…',
  'common.cancel': 'Цуцлах',
  'common.close': 'Хаах',
  'common.delete': 'Устгах',
  'common.edit': 'Засах',
  'common.done': 'Болсон',
  'common.back': 'Буцах',
  'common.next': 'Дараах',
  'common.previous': 'Өмнөх',
  'common.start': 'Эхлэх',
  'common.retry': 'Дахин оролдох',
  'common.continue': 'Үргэлжлүүлэх',
  'common.confirm': 'Батлах',
  'common.yes': 'Тийм',
  'common.no': 'Үгүй',
  'common.loading': 'Ачааллаж байна…',
  'common.search': 'Хайх',
  'common.copy': 'Хуулах',
  'common.copied': 'Хуулсан!',
  'common.download': 'Татах',
  'common.open': 'Нээх',
  'common.play': 'Тоглуулах',
  'common.pause': 'Түр зогсоох',
  'common.stop': 'Зогсоох',
  'common.replay': 'Дахин тоглуулах',
  'common.error': 'Ямар нэгэн алдаа гарлаа. Дахин оролдоно уу.',
  'common.networkError': 'Интернэт холболт тасарсан байна. Холболтоо шалгаад дахин оролдоно уу.',
  'common.required': 'Заавал',
  'common.optional': 'Сонголттой',
  'common.new': 'Шинэ',
  'common.pro': 'Pro',
  'common.free': 'Үнэгүй',
  'common.guest': 'Зочин',
  'common.account': 'Данс',
  'common.language': 'Хэл',
  'common.words': 'үг',
  'common.word': 'үг',
  'common.minutes': 'мин',
  'common.today': 'Өнөөдөр',
  'common.all': 'Бүгд',
  'common.none': 'Байхгүй',
  'common.name': 'Нэр',
  'common.email': 'Имэйл',
  'common.password': 'Нууц үг',
};

export const pwaMn: Record<PwaKeys, string> = {
  'pwa.install.title': 'AudioRepeat-г суулгах',
  'pwa.install.body':
    'AudioRepeat-г утасны үндсэн дэлгэцэнд нэмээрэй — бүтэн дэлгэцээр дадлагажиж, аудио офлайн ажиллана.',
  'pwa.install.button': 'Аппыг суулгах',
  'pwa.install.later': 'Дараа',
  'pwa.install.ios': 'Хуваалцах товчийг дараад “Үндсэн дэлгэцэнд нэмэх”-ийг сонгоно уу.',
  'pwa.installed': 'Апп суугдлаа',
  // PWA install surface lives in the root layout — keys kept in core so any
  // route can render the prompt without the dashboard namespace.
  'dashboard.install.addTitle': 'Үндсэн дэлгэцэнд нэмэх',
  'dashboard.install.dismissAria': 'Хаах',
  'dashboard.install.menuPrefix': 'Браузерын цэсийг нээгээд сонгоно уу',
  'dashboard.install.or': 'эсвэл',
};

export const syncMn: Record<SyncKeys, string> = {
  'sync.state.idle': 'Клауд синк бэлэн',
  'sync.state.syncing': 'Синк хийж байна…',
  'sync.state.synced': 'Синк хийгдсэн',
  'sync.state.offline': 'Офлайн — өөрчлөлтийг төхөөрөмжинд хадгалж байна',
  'sync.state.error': 'Синкийн асуудал гарлаа — удахгүй дахин оролдоно',
  'sync.lastSynced': 'Сүүлийн синк: {time}',
};

export const errorsMn: Record<ErrorKeys, string> = {
  'error.generic.title': 'Алдаа гарлаа',
  'error.generic.body':
    'Гэнэтийн алдаа гарлаа. Таны мэдээлэл аюулгүй — дахин оролдоно уу.',
  'error.empty.sets.title': 'Одоогоор багц алга',
  'error.empty.sets.body': 'Эхний багцаа үүсгэх эсвэл Сангаас сонгоорой.',
  'error.empty.words.title': 'Энэ багцад үг алга',
  'error.empty.words.body': 'Дадлаж эхлэхийн тулд үг нэмээрэй.',
  'error.offline.title': 'Та офлайн байна',
  'error.offline.body': 'Дадлага офлайн ч ажилладаг — холбогдсон даруйдаа синк хийгдэнэ.',
  // Global error boundary lives on every route — key kept in core.
  'dashboard.error.dashboardLink': 'Дашборд',
};

export const mn = { ...commonMn, ...pwaMn, ...syncMn, ...errorsMn };
