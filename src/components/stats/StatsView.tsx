'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import ActivityHeatmap, {
  HEATMAP_LEVEL_CLASSES,
  heatmapCellTitle,
  heatmapLevel,
} from '@/components/ActivityHeatmap';
import { usePracticeStats } from '@/hooks/usePracticeStats';
import { formatDuration } from '@/lib/format';
import ProfileDropdown from '@/components/auth/ProfileDropdown';
import SettingsButton from '@/components/settings/SettingsButton';
import { lastNDays, totals, weeklyBuckets } from '@/lib/practiceStats';

const CHART_HEIGHT = 120;

function Tile({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="glass rounded-2xl p-4">
      <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-1 truncate text-2xl font-bold tabular-nums text-white">{value}</p>
      <p className="text-[11px] text-slate-500">{sub}</p>
    </div>
  );
}

export default function StatsView() {
  const { days, week, wordsToday, msToday, streak, loaded } = usePracticeStats();
  const month = useMemo(() => lastNDays(days, 30), [days]);
  const all = useMemo(() => totals(days), [days]);
  const weeks = useMemo(() => weeklyBuckets(days, 8), [days]);

  const monthMax = Math.max(0, ...month.map((d) => d.words));
  const weekMax = Math.max(0, ...weeks.map((w) => w.words));

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-5 pb-20 pt-8">
      <header className="animate-fade-up mb-6 flex items-center gap-2">
        <Link
          href="/"
          className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm text-slate-400 transition hover:bg-white/5 hover:text-white"
          aria-label="Back to library"
        >
          <span>←</span>
          <span>Library</span>
        </Link>
        <span className="text-slate-700">/</span>
        <h1 className="text-2xl font-bold tracking-tight text-white">Stats</h1>
        <span className="ml-auto flex items-center gap-2">
          <SettingsButton />
          <ProfileDropdown onLeaderboard={() => {}} onSubtitles={() => {}} onBrowse={() => {}} />
        </span>
      </header>

      <section className="glass animate-fade-up rounded-3xl p-8 text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-neon-amber to-neon-magenta text-night-950 shadow-[0_0_40px_rgba(255,201,77,0.35)]">
          <svg viewBox="0 0 24 24" className="h-10 w-10" fill="currentColor" aria-hidden="true">
            <path d="M12 2c2.5 2.5 4 5 4 8a4 4 0 0 1-8 0c0-1.1.3-2.1.8-3C6.5 8 5 10.4 5 13a7 7 0 0 0 14 0c0-5.5-4-8-7-11Z" />
            <path d="M12 8c1 1.4 2 2.6 2 4a2 2 0 1 1-4 0c0-1 .4-2 1-3 .3-.4.6-.7 1-1Z" opacity="0.55" />
          </svg>
        </div>
        <p className="mt-4 text-6xl font-bold tabular-nums text-white">{streak}</p>
        <p className="mt-1 text-sm font-medium uppercase tracking-[0.25em] text-slate-400">
          day streak
        </p>
        <p className="mt-3 text-xs text-slate-500">
          Best: {all.bestStreak} days · {all.activeDays} active days
        </p>
      </section>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label="Today" value={String(wordsToday)} sub="words listened" />
        <Tile label="Today" value={formatDuration(msToday)} sub="study time" />
        <Tile label="All time" value={all.words.toLocaleString()} sub="words listened" />
        <Tile label="All time" value={formatDuration(all.ms)} sub="study time" />
      </div>

      {loaded && all.activeDays === 0 ? (
        <section className="glass animate-fade-up mt-4 rounded-2xl p-10 text-center">
          <p className="text-lg font-semibold text-white">No practice yet</p>
          <p className="mx-auto mt-2 max-w-sm text-sm text-slate-400">
            Open a set and press play — your streak and stats will start building here.
          </p>
          <Link
            href="/"
            className="mt-5 inline-block rounded-xl bg-gradient-to-r from-neon-cyan to-neon-violet px-5 py-2.5 text-sm font-semibold text-night-950 transition hover:brightness-110 active:scale-95"
          >
            Back to library
          </Link>
        </section>
      ) : (
        <>
          <section className="glass animate-fade-up mt-4 rounded-2xl p-5">
            <h2 className="text-sm font-semibold text-white">This week</h2>
            <ActivityHeatmap week={week} />
          </section>

          <section className="glass animate-fade-up mt-4 rounded-2xl p-5">
            <h2 className="text-sm font-semibold text-white">Last 30 days</h2>
            <div className="mt-4 grid grid-cols-6 gap-1.5">
              {month.map((cell) => (
                <div
                  key={cell.key}
                  title={heatmapCellTitle(cell)}
                  className={`flex aspect-square items-center justify-center rounded-lg text-[10px] font-semibold tabular-nums transition-colors duration-300 ${
                    HEATMAP_LEVEL_CLASSES[heatmapLevel(cell.words, monthMax)]
                  } ${cell.isToday ? 'ring-1 ring-neon-cyan/60 ring-offset-1 ring-offset-night-900' : ''}`}
                >
                  {cell.dayOfMonth}
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-end gap-1 text-[10px] text-slate-600">
              <span>Less</span>
              {HEATMAP_LEVEL_CLASSES.map((cls, i) => (
                <span key={i} className={`h-2.5 w-2.5 rounded-sm ${cls}`} />
              ))}
              <span>More</span>
            </div>
          </section>

          <section className="glass animate-fade-up mt-4 rounded-2xl p-5">
            <h2 className="text-sm font-semibold text-white">Last 8 weeks</h2>
            <p className="text-[11px] text-slate-500">words listened per week</p>
            <div className="mt-4 flex items-end gap-2">
              {weeks.map((w, i) => (
                <div key={i} className="flex flex-1 flex-col items-center justify-end gap-1">
                  <span className="text-[10px] tabular-nums text-slate-500">
                    {w.words > 0 ? w.words : ''}
                  </span>
                  <div
                    title={`Week of ${w.label} — ${w.words} words · ${formatDuration(w.ms)}`}
                    className={
                      w.words > 0
                        ? 'w-full rounded-t-md bg-gradient-to-t from-neon-violet/50 to-neon-cyan'
                        : 'h-1 w-full rounded bg-night-700/40'
                    }
                    style={
                      w.words > 0
                        ? { height: Math.max(6, Math.round((w.words / weekMax) * CHART_HEIGHT)) }
                        : undefined
                    }
                  />
                  <span className="text-[9px] tabular-nums text-slate-600">{w.label}</span>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </main>
  );
}
