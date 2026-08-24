'use client';

import { seedCodeForLangKey } from '@/lib/freeLang';
import { findLanguage } from '@/lib/languages';
import { useT } from '@/lib/i18n';

interface Props {
  /** Normalized pack key of the Free user's included language, or null. */
  langKey: string | null;
  /** Hidden entirely for Pro/Lifetime users. */
  pro: boolean;
  onChange: () => void;
}

/**
 * Compact dashboard bar showing which language the Free plan includes, with a
 * Change action. Hidden for Pro/Lifetime (no one-language restriction) and
 * while no selection exists yet (the onboarding picker owns that state).
 */
export default function FreeLanguageBar({ langKey, pro, onChange }: Props) {
  const t = useT();
  if (pro || !langKey) return null;
  const label = findLanguage(seedCodeForLangKey(langKey) ?? langKey)?.label ?? langKey;

  return (
    <div className="animate-fade-up mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-neon-cyan/25 bg-neon-cyan/[0.05] px-4 py-3">
      <p className="min-w-0 text-sm text-slate-300">
        <span className="mr-1.5" aria-hidden>
          🌍
        </span>
        {t('onboarding.bar.your')}{' '}
        <span className="font-semibold text-neon-cyan">{t('onboarding.bar.freeLanguage')}</span>:{' '}
        <span className="font-semibold text-white">{label}</span>
      </p>
      <button
        onClick={onChange}
        className="shrink-0 rounded-lg border border-neon-cyan/40 px-3.5 py-1.5 text-xs font-bold text-neon-cyan transition hover:bg-neon-cyan/10 active:scale-95"
      >
        {t('onboarding.bar.change')}
      </button>
    </div>
  );
}
