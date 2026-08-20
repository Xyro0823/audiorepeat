'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, Circle, Headphones, Languages, LibraryBig, X } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { gettingStartedDismissKey, gettingStartedProgress } from '@/lib/gettingStarted';
import InstallAppButton from '@/components/pwa/InstallAppButton';

interface Props {
  languageReady: boolean;
  setReady: boolean;
  practiceReady: boolean;
  canPlay: boolean;
  onChooseLanguage: () => void;
  onBrowse: () => void;
  onPlay: () => void;
}

function installedAsApp(): boolean {
  if (typeof window === 'undefined') return false;
  const iosNavigator = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia('(display-mode: standalone)').matches || iosNavigator.standalone === true;
}

export default function GettingStartedChecklist({
  languageReady,
  setReady,
  practiceReady,
  canPlay,
  onChooseLanguage,
  onBrowse,
  onPlay,
}: Props) {
  const { user } = useAuth();
  const dismissKey = gettingStartedDismissKey(user?.id);
  const [dismissed, setDismissed] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setDismissed(window.localStorage.getItem(dismissKey) === '1');
    });
    return () => window.cancelAnimationFrame(frame);
  }, [dismissKey]);

  useEffect(() => {
    const update = () => setInstalled(installedAsApp());
    const frame = window.requestAnimationFrame(update);
    window.addEventListener('appinstalled', update);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('appinstalled', update);
    };
  }, []);

  const state = useMemo(
    () => ({ languageReady, setReady, practiceReady, installed }),
    [languageReady, setReady, practiceReady, installed],
  );
  const complete = gettingStartedProgress(state);

  if (dismissed || complete === 4) return null;

  const dismiss = () => {
    window.localStorage.setItem(dismissKey, '1');
    setDismissed(true);
  };

  const tasks = [
    { label: 'Choose your language', done: languageReady, icon: Languages, action: onChooseLanguage, actionLabel: 'Choose' },
    { label: 'Add a practice set', done: setReady, icon: LibraryBig, action: onBrowse, actionLabel: 'Browse sets' },
    { label: 'Play your first loop', done: practiceReady, icon: Headphones, action: onPlay, actionLabel: 'Start practice', disabled: !canPlay },
  ];

  return (
    <section className="glass animate-fade-up relative mt-5 rounded-3xl p-4 sm:p-5" aria-labelledby="getting-started-title">
      <button type="button" onClick={dismiss} aria-label="Dismiss getting started checklist" className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full text-slate-400 transition hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300">
        <X className="h-4 w-4" aria-hidden />
      </button>
      <div className="pr-11 sm:flex sm:items-end sm:justify-between sm:gap-5">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-neon-cyan">Quick start</p>
          <h2 id="getting-started-title" className="mt-1 text-lg font-semibold text-white">Get ready for your first listening loop</h2>
          <p className="mt-1 text-xs text-slate-400">{complete} of 4 steps complete</p>
        </div>
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/10 sm:mt-0 sm:max-w-48" aria-label={`${complete} of 4 steps complete`}>
          <div className="h-full rounded-full bg-gradient-to-r from-neon-violet to-neon-cyan transition-[width]" style={{ width: `${complete * 25}%` }} />
        </div>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {tasks.map(({ label, done, icon: Icon, action, actionLabel, disabled }) => (
          <div key={label} className={`rounded-2xl border p-3 ${done ? 'border-emerald-400/20 bg-emerald-400/[0.06]' : 'border-white/10 bg-white/[0.035]'}`}>
            <div className="flex items-center gap-2.5">
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${done ? 'bg-emerald-400/15 text-emerald-300' : 'bg-white/[0.06] text-slate-300'}`}>
                {done ? <Check className="h-4 w-4" aria-hidden /> : <Icon className="h-4 w-4" aria-hidden />}
              </span>
              <span className={`text-xs font-semibold ${done ? 'text-emerald-200' : 'text-slate-200'}`}>{label}</span>
            </div>
            {!done && (
              <button type="button" disabled={disabled} onClick={action} className="mt-3 min-h-10 w-full rounded-xl border border-white/10 bg-white/[0.05] px-3 text-xs font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300">
                {actionLabel}
              </button>
            )}
          </div>
        ))}
        <div className={`rounded-2xl border p-3 ${installed ? 'border-emerald-400/20 bg-emerald-400/[0.06]' : 'border-white/10 bg-white/[0.035]'}`}>
          <div className="flex items-center gap-2.5">
            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${installed ? 'bg-emerald-400/15 text-emerald-300' : 'bg-white/[0.06] text-slate-300'}`}>
              {installed ? <Check className="h-4 w-4" aria-hidden /> : <Circle className="h-4 w-4" aria-hidden />}
            </span>
            <span className={`text-xs font-semibold ${installed ? 'text-emerald-200' : 'text-slate-200'}`}>Install the app</span>
          </div>
          {!installed && <div className="mt-3"><InstallAppButton variant="checklist" /></div>}
        </div>
      </div>
    </section>
  );
}
