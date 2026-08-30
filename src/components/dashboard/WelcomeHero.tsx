'use client';

import { useT } from '@/lib/i18n';
import { formatDuration } from '@/lib/format';

interface Props {
  wordsToday: number;
  msToday: number;
  streak: number;
  setName?: string;
  setWords?: number;
  progressPct?: number;
  /** Optional primary action — e.g. resume the featured set. */
  onStart?: () => void;
  /** Empty-library action — opens the ready-made library without a dead end. */
  onBrowse?: () => void;
}

/**
 * Hero welcome section — a dark radial blue gradient banner with a frosted
 * "Welcome back" capsule, a short greeting, and today's practice chips.
 */
export default function WelcomeHero({ wordsToday, msToday, streak, setName, setWords = 0, progressPct = 0, onStart, onBrowse }: Props) {
  const t = useT();
  return (
    <section className="relative z-10 overflow-hidden rounded-3xl border border-cyan-400/15 bg-gradient-to-br from-[#111b2d] via-[#10131c] to-[#090b12] px-5 py-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_20px_50px_rgba(0,0,0,0.35)] md:px-10 md:py-8">
      {/* Ambient violet/blue glows — harmonized with the hero palette but kept
          ~25–30% below the hero's saturation so the CTA stays the strongest
          blue element and the card never reads as bright purple. */}
      <div className="pointer-events-none absolute -right-24 -top-28 h-80 w-80 rounded-full bg-indigo-600/18 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -left-20 h-72 w-72 rounded-full bg-violet-500/10 blur-3xl" />

      <div className="relative">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-neon-cyan">{t('dashboard.nextAction.kicker')}</p>
        <h1 className="mt-2 truncate text-2xl font-bold tracking-tight text-white md:text-3xl">{setName ?? t('dashboard.nextAction.noSet')}</h1>
        {setName ? (
          <div className="mt-5 grid grid-cols-[1fr_auto] items-center gap-4">
            <div><div className="h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-neon-cyan to-blue-500" style={{ width: `${progressPct}%` }} /></div><p className="mt-2 text-xs text-slate-400"><span className="font-semibold text-cyan-200">{progressPct}%</span> · {setWords.toLocaleString()} {t('common.words')}</p></div>
            {onStart && <button type="button" onClick={onStart} className="btn-primary flex min-h-11 items-center gap-2 rounded-xl px-4 text-sm font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan"><svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden><path d="M8 5.5v13a1 1 0 0 0 1.5.87l11-6.5a1 1 0 0 0 0-1.74l-11-6.5A1 1 0 0 0 8 5.5Z" /></svg>{t('dashboard.nextAction.continue')}</button>}
          </div>
        ) : (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/[0.08] bg-black/15 p-3.5">
            <p className="max-w-md text-sm leading-5 text-slate-400">{t('dashboard.nextAction.noSetBody')}</p>
            {onBrowse && <button type="button" onClick={onBrowse} className="btn-primary min-h-11 rounded-xl px-4 text-sm font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan">{t('dashboard.nextAction.browseSets')}</button>}
          </div>
        )}
        <div className="mt-5 grid grid-cols-3 divide-x divide-white/10 rounded-2xl border border-white/8 bg-black/15 py-3 text-center text-xs"><span><b className="block text-base text-neon-cyan">{wordsToday}</b><small className="text-slate-400">{t('dashboard.nextAction.wordsToday')}</small></span><span><b className="block text-base text-neon-amber">{streak}</b><small className="text-slate-400">{t('dashboard.nextAction.streak')}</small></span><span><b className="block text-base text-neon-violet">{formatDuration(msToday)}</b><small className="text-slate-400">{t('dashboard.nextAction.studyTime')}</small></span></div>
      </div>
    </section>
  );
}
