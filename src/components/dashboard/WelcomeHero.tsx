'use client';

import { useT } from '@/lib/i18n';
import { formatDuration } from '@/lib/format';

interface Props {
  wordsToday: number;
  msToday: number;
  streak: number;
  /** Optional primary action — e.g. resume the featured set. */
  onStart?: () => void;
}

/**
 * Hero welcome section — a dark radial blue gradient banner with a frosted
 * "Welcome back" capsule, a short greeting, and today's practice chips.
 */
export default function WelcomeHero({ wordsToday, msToday, streak, onStart }: Props) {
  const t = useT();
  return (
    <section className="relative z-10 overflow-hidden rounded-3xl border border-violet-400/10 bg-gradient-to-br from-indigo-950/60 via-zinc-900 to-black/95 px-6 py-8 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_20px_50px_rgba(0,0,0,0.35)] md:px-10">
      {/* Ambient violet/blue glows — harmonized with the hero palette but kept
          ~25–30% below the hero's saturation so the CTA stays the strongest
          blue element and the card never reads as bright purple. */}
      <div className="pointer-events-none absolute -right-24 -top-28 h-80 w-80 rounded-full bg-indigo-600/18 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -left-20 h-72 w-72 rounded-full bg-violet-500/10 blur-3xl" />

      <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div className="max-w-xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[11px] font-medium text-slate-200 backdrop-blur-md">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]" />
            {t('dashboard.welcome.back')}
          </span>
          <h2 className="mt-3 text-2xl font-bold tracking-tight text-white md:text-3xl">
            {t('dashboard.welcome.title')}
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-400">
            {t('dashboard.welcome.subtitle')}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <span className="glass inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-medium text-slate-200">
            <span aria-hidden>🎧</span>{' '}
            {t(wordsToday === 1 ? 'dashboard.chips.wordsToday.one' : 'dashboard.chips.wordsToday.other', { count: wordsToday })}
          </span>
          <span className="glass inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-medium text-slate-200">
            <span aria-hidden>⏱</span> {t('dashboard.chips.studied', { time: formatDuration(msToday) })}
          </span>
          <span className="glass inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-medium text-neon-amber">
            <span aria-hidden>🔥</span>{' '}
            {streak > 0
              ? t(streak === 1 ? 'dashboard.streakDays.one' : 'dashboard.streakDays.other', { count: streak })
              : t('dashboard.chips.streakStart')}
          </span>
          {onStart && (
            <button
              onClick={onStart}
              className="btn-primary flex h-11 items-center gap-1.5 rounded-full px-5 text-[13px] font-semibold text-white"
            >
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
                <path d="M8 5.5v13a1 1 0 0 0 1.5.87l11-6.5a1 1 0 0 0 0-1.74l-11-6.5A1 1 0 0 0 8 5.5Z" />
              </svg>
              {t('dashboard.welcome.startLearning')}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
