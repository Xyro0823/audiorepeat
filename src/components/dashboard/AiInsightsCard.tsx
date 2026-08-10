'use client';

interface Props {
  /** Words currently marked as needing review (hard) across the library. */
  reviewCount: number;
  /** Daily listening-goal completion, 0–100. */
  goalPct: number;
  /** Current practice streak in days. */
  streak: number;
}

/**
 * AI Insights & Recommendations — a dark glassmorphic card with smart review
 * prompts, each with a pure-emerald status dot, plus the daily audio goal bar.
 */
export default function AiInsightsCard({ reviewCount, goalPct, streak }: Props) {
  const rows = [
    {
      dot: 'bg-emerald-400',
      glow: 'shadow-[0_0_8px_rgba(52,211,153,0.8)]',
      text:
        reviewCount > 0
          ? `${reviewCount} word${reviewCount === 1 ? '' : 's'} need review today`
          : 'All caught up — nothing needs review',
      meta: reviewCount > 0 ? 'Tap review mode in the player' : 'Nice work!',
    },
    {
      dot: 'bg-emerald-400',
      glow: 'shadow-[0_0_8px_rgba(52,211,153,0.8)]',
      text:
        goalPct >= 100
          ? 'Daily audio goal complete'
          : `Daily audio goal ${goalPct}% complete`,
      meta: goalPct >= 100 ? 'Fantastic focus 🎉' : `${100 - goalPct}% to go — keep listening`,
    },
    {
      dot: 'bg-emerald-400',
      glow: 'shadow-[0_0_8px_rgba(52,211,153,0.8)]',
      text: streak > 0 ? `${streak}-day streak — keep it alive` : 'Start a streak today',
      meta: streak > 0 ? 'Consistency beats intensity' : 'One short session is enough',
    },
  ];

  return (
    <section
      id="ai-insights"
      className="scroll-mt-24 rounded-2xl border border-blue-500/20 bg-slate-900/60 p-4 backdrop-blur-xl transition-shadow duration-300"
    >
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-r from-blue-600 to-cyan-500 text-white">
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
            <path d="M12 2.5c.4 2.9 1.5 4.9 3.4 6.6 1.9 1.6 3.9 2.5 6.1 2.9-2.2.4-4.2 1.3-6.1 2.9-1.9 1.7-3 3.7-3.4 6.6-.4-2.9-1.5-4.9-3.4-6.6C7.7 13.3 5.7 12.4 3.5 12c2.2-.4 4.2-1.3 6.1-2.9 1.9-1.7 3-3.7 3.4-6.6Z" />
            <path d="M19 16.5c.15 1.1.55 1.9 1.25 2.5-.7.6-1.1 1.4-1.25 2.5-.15-1.1-.55-1.9-1.25-2.5.7-.6 1.1-1.4 1.25-2.5Z" />
          </svg>
        </span>
        <div>
          <h3 className="text-sm font-semibold tracking-tight text-white">AI Insights</h3>
          <p className="text-[11px] text-slate-500">Smart recommendations for today</p>
        </div>
      </div>

      <ul className="mt-3.5 space-y-3">
        {rows.map((r) => (
          <li key={r.text} className="flex items-start gap-2.5">
            <span
              aria-hidden
              className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${r.dot} ${r.glow}`}
            />
            <span className="min-w-0">
              <span className="block text-[13px] font-medium leading-snug text-slate-200">
                {r.text}
              </span>
              <span className="mt-0.5 block text-[11px] leading-snug text-slate-500">
                {r.meta}
              </span>
            </span>
          </li>
        ))}
      </ul>

      {/* Daily audio goal bar */}
      <div className="mt-4">
        <div className="flex items-center justify-between text-[11px] text-slate-500">
          <span className="font-medium text-slate-400">Daily audio goal</span>
          <span className="font-semibold tabular-nums text-neon-cyan">{goalPct}%</span>
        </div>
        <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-500"
            style={{ width: `${Math.min(100, Math.max(0, goalPct))}%` }}
          />
        </div>
      </div>
    </section>
  );
}
