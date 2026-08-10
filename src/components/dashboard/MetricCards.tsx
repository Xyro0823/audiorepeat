'use client';

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
  const streakPct = Math.min(100, Math.round((streak / STREAK_TARGET) * 100));

  const cards = [
    {
      label: 'Listening Accuracy',
      value: `${accuracyPct}%`,
      pct: accuracyPct,
      hint: 'Mastered vs. review words',
    },
    {
      label: 'Words Mastered',
      value: masteredCount.toLocaleString(),
      pct: Math.min(100, masteredCount),
      hint: 'Known across all sets',
    },
    {
      label: 'Study Streak',
      value: `${streak} day${streak === 1 ? '' : 's'}`,
      pct: streakPct,
      hint: `${STREAK_TARGET}-day habit target`,
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-3">
      {cards.map((c) => (
        <div
          key={c.label}
          className="rounded-2xl border border-white/10 bg-zinc-900/60 p-3 backdrop-blur-md sm:p-4"
        >
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
            {c.label}
          </p>
          <p className="mt-1.5 text-lg font-bold tabular-nums tracking-tight text-white sm:text-2xl">
            {c.value}
          </p>
          <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-500"
              style={{ width: `${Math.min(100, Math.max(0, c.pct))}%` }}
            />
          </div>
          <p className="mt-1.5 text-[10px] leading-snug text-slate-500 sm:text-[11px]">{c.hint}</p>
        </div>
      ))}
    </div>
  );
}
