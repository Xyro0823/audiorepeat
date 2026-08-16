'use client';

import { useMemo, useState } from 'react';
import { flagFor } from '@/components/LanguageBadge';
import { FREE_LANG_OPTIONS } from '@/lib/freeLang';
import { FREE_LANG_LIMIT } from '@/lib/plans';

interface Props {
  /** Pro/Lifetime — every language is selectable without locks. */
  pro: boolean;
  /** Previously chosen language (normalized key) to preselect, if any. */
  initialKey?: string | null;
  /** Called with the chosen normalized language key. */
  onContinue: (key: string) => void;
  /** Headline override (defaults to the onboarding copy). */
  title?: string;
  /** Supporting copy override. */
  subtitle?: string;
}

/**
 * Grid of every language the app can seed content for. Free users see the
 * single included language marked "✓ Included with Free" and everything else
 * as "🔒 Pro"; Pro/Lifetime users pick a preferred language with no locks.
 * Pure selection UI — enforcement lives in planGate.canUseLang.
 */
export default function FreeLanguagePicker({
  pro,
  initialKey,
  onContinue,
  title = 'Choose your free language',
  subtitle = pro
    ? 'Your plan includes every language — pick the one you want to focus on.'
    : `Your Free plan includes ${FREE_LANG_LIMIT} language. Choose the language you want to practice.`,
}: Props) {
  const [selected, setSelected] = useState<string | null>(initialKey ?? null);

  const options = useMemo(() => FREE_LANG_OPTIONS, []);

  return (
    <div className="w-full">
      <h2 className="text-xl font-bold tracking-tight text-white">{title}</h2>
      <p className="mt-1.5 text-sm leading-relaxed text-slate-400">{subtitle}</p>

      <div
        className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3"
        role="radiogroup"
        aria-label="Language"
      >
        {options.map((opt) => {
          const active = selected === opt.key;
          const included = active && !pro;
          const locked = !active && !pro;
          return (
            <button
              key={opt.key}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setSelected(opt.key)}
              className={`relative flex min-w-0 flex-col items-start gap-1.5 rounded-2xl border p-3.5 text-left transition active:scale-[0.98] ${
                active
                  ? 'border-neon-cyan/60 bg-neon-cyan/10 ring-1 ring-neon-cyan/50'
                  : locked
                    ? 'border-white/10 bg-night-800/60 hover:border-white/25'
                    : 'border-white/15 bg-white/[0.04] hover:border-white/30'
              }`}
            >
              <span className="text-2xl leading-none" aria-hidden>
                {flagFor(opt.code) ?? '🌐'}
              </span>
              <span className="min-w-0">
                <span
                  className={`block truncate text-[13px] font-semibold ${
                    active ? 'text-white' : 'text-slate-200'
                  }`}
                >
                  {opt.label}
                </span>
                <span
                  className={`mt-0.5 block text-[10px] font-medium ${
                    included ? 'text-neon-cyan' : locked ? 'text-neon-amber' : 'text-slate-500'
                  }`}
                >
                  {included ? '✓ Included with Free' : locked ? '🔒 Pro' : '✓ Preferred'}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => {
          if (selected) onContinue(selected);
        }}
        disabled={!selected}
        className="mt-6 w-full rounded-xl bg-gradient-to-r from-neon-cyan to-neon-violet py-3 text-sm font-bold text-night-950 shadow-[0_0_20px_rgba(34,228,255,0.35)] transition hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
      >
        Continue
      </button>
    </div>
  );
}
