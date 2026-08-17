'use client';

import Link from 'next/link';
import { useState } from 'react';
import { FREE_LANG_LIMIT, LANGUAGES_UNLOCKED_BY_PRO } from '@/lib/plans';
import { SUPPORTED_LANGUAGE_COUNT } from '@/lib/freeLang';

const DISMISS_KEY = 'audiorepeat-free-plan-notice-dismissed';

interface Props {
  /** Pro gate — hidden entirely for Pro/Lifetime users. */
  pro: boolean;
}

/**
 * Small, dismissible upgrade notice for the Free plan's 1-language limit.
 *
 * The count is an entitlement, not a card census: upgrading from Free
 * (FREE_LANG_LIMIT active language) to Pro unlocks every supported language
 * (SUPPORTED_LANGUAGE_COUNT), so it is always derived from those canonical
 * constants — never from how many seeded sets/cards happen to exist locally.
 * Hidden entirely for Pro/Lifetime users.
 */
export default function FreePlanNotice({ pro }: Props) {
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      return window.localStorage.getItem(DISMISS_KEY) === '1';
    } catch {
      return false;
    }
  });

  const missing = pro ? 0 : LANGUAGES_UNLOCKED_BY_PRO;
  const totalLangs = SUPPORTED_LANGUAGE_COUNT;

  if (dismissed || missing === 0) return null;

  return (
    <div className="animate-fade-up mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-neon-amber/30 bg-neon-amber/[0.06] px-4 py-3">
      <p className="min-w-0 text-sm text-slate-300">
        <span className="mr-1.5" aria-hidden>
          ⭐
        </span>
        Your <span className="font-semibold text-neon-amber">Free</span> plan includes {FREE_LANG_LIMIT}{' '}
        {FREE_LANG_LIMIT === 1 ? 'language' : 'languages'} —{' '}
        {missing === 1 ? '1 more language is' : `${missing} more languages are`} ready to unlock.
        <span className="text-slate-500"> {totalLangs} total.</span>
      </p>
      <div className="flex shrink-0 items-center gap-2">
        <Link
          href="/checkout?plan=pro"
          className="rounded-lg bg-gradient-to-r from-neon-amber to-neon-magenta px-3.5 py-1.5 text-xs font-bold text-night-950 transition hover:brightness-110 active:scale-95"
        >
          Upgrade to unlock
        </Link>
        <button
          onClick={() => {
            setDismissed(true);
            try {
              window.localStorage.setItem(DISMISS_KEY, '1');
            } catch {
              /* storage unavailable */
            }
          }}
          aria-label="Dismiss upgrade notice"
          className="rounded-lg px-2 py-1 text-slate-500 transition hover:bg-white/5 hover:text-white"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
