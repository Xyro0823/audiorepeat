export default function StreakBadge({ streak }: { streak: number }) {
  const active = streak > 0;
  return (
    <span
      title={active ? `${streak}-day practice streak` : 'No streak yet — practice today to start one'}
      className={`streak-badge flex h-11 shrink-0 items-center gap-1.5 rounded-xl border px-3 text-[11px] font-semibold tabular-nums ${
        active ? 'border-neon-amber/25 bg-neon-amber/10 text-neon-amber' : 'border-white/[0.06] bg-white/[0.02] text-slate-400'
      }`}
    >
      <svg
        viewBox="0 0 24 24"
        className="h-3.5 w-3.5"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M12 2c2.5 2.5 4 5 4 8a4 4 0 0 1-8 0c0-1.1.3-2.1.8-3C6.5 8 5 10.4 5 13a7 7 0 0 0 14 0c0-5.5-4-8-7-11Z" />
        <path d="M12 8c1 1.4 2 2.6 2 4a2 2 0 1 1-4 0c0-1 .4-2 1-3 .3-.4.6-.7 1-1Z" opacity="0.55" />
      </svg>
      {streak}
    </span>
  );
}
