export interface DayStat {
  w: number; // words listened
  ms: number; // study time (ms)
  /** Per-language breakdown for the day (keyed by set language, BCP-47). */
  langs?: Record<string, { w: number; ms: number }>;
}

export type DayMap = Record<string, DayStat>;

/** Ranked per-language activity for one day (by ms, then words). */
export interface DayLangRow {
  lang: string;
  w: number;
  ms: number;
}

/** All entries from `days[key].langs` with non-zero activity, sorted by time then words. */
export function dayByLang(days: DayMap, key: string): DayLangRow[] {
  const langs = days[key]?.langs ?? {};
  return Object.entries(langs)
    .map(([lang, s]) => ({ lang, w: s.w, ms: s.ms }))
    .filter((r) => r.ms > 0 || r.w > 0)
    .sort((a, b) => b.ms - a.ms || b.w - a.w);
}

/** One day in a rolling activity view. */
export interface DayCell {
  key: string; // YYYY-MM-DD
  weekday: string; // two-letter label, e.g. 'Mo'
  dayOfMonth: number;
  words: number;
  ms: number;
  isToday: boolean;
}

export interface WeeklyBucket {
  label: string; // start date, e.g. '6/15'
  words: number;
  ms: number;
}

export function dayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Monday key for the calendar week that contains `d`, using local time. */
export function weekKey(d: Date): string {
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const weekday = start.getDay();
  start.setDate(start.getDate() - (weekday === 0 ? 6 : weekday - 1));
  return dayKey(start);
}

/** Consecutive practiced days ending today (or yesterday, so the flame doesn't flicker off mid-day). */
export function computeStreak(days: DayMap): number {
  const cursor = new Date();
  if (!days[dayKey(cursor)]) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (days[dayKey(cursor)]) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

/**
 * Whole days since the most recent day with real activity (0 = today),
 * or null when nothing has ever been recorded. Powers the factual
 * streak-recovery note for lapsed returning users.
 */
export function daysSinceLastPractice(days: DayMap, today = new Date()): number | null {
  const toDayNum = (key: string): number => {
    const parsed = Date.parse(`${key}T00:00:00Z`) / 86_400_000;
    return Number.isFinite(parsed) ? Math.floor(parsed) : Number.NaN;
  };
  let latest: number | null = null;
  for (const k of Object.keys(days)) {
    const s = days[k];
    if (!s || (s.w <= 0 && s.ms <= 0)) continue; // ignore empty placeholder days
    const num = toDayNum(k);
    if (!Number.isNaN(num) && (latest === null || num > latest)) latest = num;
  }
  if (latest === null) return null;
  const todayNum = toDayNum(dayKey(today));
  if (Number.isNaN(todayNum)) return null;
  return Math.max(0, todayNum - latest);
}

/** Longest run of consecutive practiced days anywhere in the history. */
export function bestStreak(days: DayMap): number {
  const sorted = Object.keys(days).sort();
  let best = 0;
  let run = 0;
  let prev: number | null = null;
  for (const k of sorted) {
    const day = Date.parse(`${k}T00:00:00Z`) / 86400000; // UTC day number, DST-proof
    if (prev !== null && day - prev === 1) run += 1;
    else run = 1;
    if (run > best) best = run;
    prev = day;
  }
  return best;
}

/** All-time sums plus active-day count and best streak. */
export function totals(days: DayMap): {
  words: number;
  ms: number;
  activeDays: number;
  bestStreak: number;
} {
  let words = 0;
  let ms = 0;
  for (const k of Object.keys(days)) {
    words += days[k].w;
    ms += days[k].ms;
  }
  return { words, ms, activeDays: Object.keys(days).length, bestStreak: bestStreak(days) };
}

/** Rolling n-day view (oldest → today), aligned to local calendar days. */
export function lastNDays(days: DayMap, n: number): DayCell[] {
  const labels = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  const today = new Date();
  const todayKey = dayKey(today);
  const out: DayCell[] = [];
  for (let i = n - 1; i >= 0; i -= 1) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
    const k = dayKey(d);
    const s = days[k] ?? { w: 0, ms: 0 };
    out.push({
      key: k,
      weekday: labels[d.getDay()],
      dayOfMonth: d.getDate(),
      words: s.w,
      ms: s.ms,
      isToday: k === todayKey,
    });
  }
  return out;
}

/** Aggregate the last `weeks` calendar weeks (oldest → newest), labeled by start date. */
export function weeklyBuckets(days: DayMap, weeks: number): WeeklyBucket[] {
  const today = new Date();
  const out: WeeklyBucket[] = [];
  for (let w = weeks - 1; w >= 0; w -= 1) {
    let words = 0;
    let ms = 0;
    for (let i = 6; i >= 0; i -= 1) {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (w * 7 + i));
      const s = days[dayKey(d)];
      if (s) {
        words += s.w;
        ms += s.ms;
      }
    }
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (w * 7 + 6));
    out.push({ label: `${start.getMonth() + 1}/${start.getDate()}`, words, ms });
  }
  return out;
}
