'use client';

import { useT } from '@/lib/i18n';
import { formatDuration } from '@/lib/format';

interface Props {
  wordsToday: number;
  msToday: number;
  goalPct: number;
  reviewDueCount: number;
  weeklyWords: number;
  weeklyActiveDays: number;
  weeklyActivity: boolean[];
  onReview: () => void;
}

/**
 * A compact dashboard overview: it makes the next two useful actions visible
 * without repeating the full library or review interfaces on the home tab.
 */
export default function HomeProgressOverview({
  wordsToday,
  msToday,
  goalPct,
  reviewDueCount,
  weeklyWords,
  weeklyActiveDays,
  weeklyActivity,
  onReview,
}: Props) {
  const t = useT();
  const reviewCopy = reviewDueCount > 0
    ? t(reviewDueCount === 1 ? 'dashboard.review.due.one' : 'dashboard.review.due.other', {
        count: reviewDueCount,
        minutes: Math.max(1, Math.ceil(reviewDueCount / 12)),
      })
    : t('dashboard.review.caughtUp');

  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-label="Өнөөдрийн ахиц">
      <article className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">{t('dashboard.insights.goalLabel')}</p>
            <p className="mt-1 text-xl font-bold tracking-tight text-white">{goalPct}%</p>
          </div>
          <span className="rounded-xl border border-cyan-300/15 bg-cyan-300/10 px-2.5 py-1 text-xs font-semibold text-cyan-100">
            {formatDuration(msToday)}
          </span>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-gradient-to-r from-neon-cyan to-blue-500 transition-[width] duration-500" style={{ width: `${goalPct}%` }} />
        </div>
        <p className="mt-3 text-sm text-slate-400">
          <span className="font-semibold text-slate-200">{wordsToday}</span> {t('dashboard.nextAction.wordsToday').toLowerCase()}
        </p>
      </article>

      <article className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">{t('dashboard.weekly.label')}</p>
        <p className="mt-1 text-xl font-bold tracking-tight text-white">{weeklyWords.toLocaleString()}</p>
        <div className="mt-4 flex h-2 items-center gap-1" aria-label={t(weeklyActiveDays === 1 ? 'dashboard.weekly.activeDays.one' : 'dashboard.weekly.activeDays.other', { count: weeklyActiveDays })}>
          {Array.from({ length: 7 }, (_, index) => (
            <span key={index} className={`h-full flex-1 rounded-full ${weeklyActivity[index] ? 'bg-neon-violet' : 'bg-white/10'}`} aria-hidden />
          ))}
        </div>
        <p className="mt-3 text-sm text-slate-400">{t('dashboard.weekly.words', { count: weeklyWords })} · {t(weeklyActiveDays === 1 ? 'dashboard.weekly.activeDays.one' : 'dashboard.weekly.activeDays.other', { count: weeklyActiveDays })}</p>
      </article>

      <article className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">{t('dashboard.review.memoryQueue')}</p>
        <h2 className="mt-1 text-lg font-bold tracking-tight text-white">{t('dashboard.reviewToday')}</h2>
        <p className="mt-2 min-h-10 text-sm leading-5 text-slate-400">{reviewCopy}</p>
        <button type="button" onClick={onReview} className="btn-clean mt-3 min-h-11 w-full rounded-xl px-3 text-sm font-semibold text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan">
          {t('dashboard.review.start')}
        </button>
      </article>
    </section>
  );
}
