'use client';

import { useT, type TKey } from '@/lib/i18n';

interface Props {
  /** Listening accuracy: mastered ÷ (mastered + hard), 0–100. */
  accuracyPct: number;
  /** Total words marked as mastered across the library. */
  masteredCount: number;
  /** Current practice streak in days. */
  streak: number;
}

const STREAK_TARGET = 30; // streak progress bar measures a 30-day habit

/**
 * Metric progress cards — dark zinc glass cards for Listening Accuracy,
 * Words Mastered and Study Streak, with sleek cyan/blue fills over a
 * translucent track.
 */
export default function MetricCards({ accuracyPct, masteredCount, streak }: Props) {
  const t = useT();
  const streakPct = Math.min(100, Math.round((streak / STREAK_TARGET) * 100));

  const cards: { id: string; labelKey: TKey; value: string; pct: number; hintKey: TKey }[] = [
    {
      id: 'accuracy',
      labelKey: 'dashboard.metric.accuracy.label',
      value: `${accuracyPct}%`,
      pct: accuracyPct,
      hintKey: 'dashboard.metric.accuracy.hint',
    },
    {
      id: 'mastered',
      labelKey: 'dashboard.metric.mastered.label',
      value: masteredCount.toLocaleString(),
      pct: Math.min(100, masteredCount),
      hintKey: 'dashboard.metric.mastered.hint',
    },
    {
      id: 'streak',
      labelKey: 'dashboard.metric.streak.label',
      value: t(streak === 1 ? 'dashboard.streakDays.one' : 'dashboard.streakDays.other', { count: streak }),
      pct: streakPct,
      hintKey: 'dashboard.metric.streak.hint',
    },
  ];

  return (
    // Stacked full-width rows on phones (MN metric labels need the room);
    // 3-across returns at ~430px+ where each cell fits the copy.
    <div className="grid grid-cols-1 gap-2 min-[430px]:grid-cols-3 sm:gap-3">
      {cards.map((c) => (
        <div
          key={c.id}
          className="rounded-2xl border border-white/10 bg-zinc-900/60 p-3 backdrop-blur-md sm:p-4"
        >
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
            {t(c.labelKey)}
          </p>
          <p className="mt-1.5 text-lg font-bold tabular-nums tracking-tight text-white sm:text-2xl">
            {c.value}
          </p>
          <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-[width] duration-500"
              style={{ width: `${Math.min(100, Math.max(0, c.pct))}%` }}
            />
          </div>
          <p className="mt-1.5 text-[10px] leading-snug text-slate-500 sm:text-[11px]">
            {c.id === 'streak'
              ? t(c.hintKey, { days: STREAK_TARGET })
              : t(c.hintKey)}
          </p>
        </div>
      ))}
    </div>
  );
}
