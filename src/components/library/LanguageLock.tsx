'use client';

import Link from 'next/link';
import { FREE_LANG_LIMIT } from '@/lib/plans';

/**
 * Shared inline lock banner for the Free-plan language rule. Rendered near
 * the language selector whenever a Free user picks a language they cannot
 * create content in (New Set editor, Subtitle import). Pro/Lifetime users
 * never see it — render it conditionally from the `canUseLang` gate. The
 * entitlement number comes from FREE_LANG_LIMIT, never a hardcoded value.
 */
export default function LanguageLock({ className = '' }: { className?: string }) {
  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border border-neon-amber/30 bg-neon-amber/[0.06] px-4 py-3 ${className}`}
    >
      <p className="min-w-0 text-sm text-slate-300">
        <span className="mr-1.5" aria-hidden>
          ⭐
        </span>
        This language needs Pro — your Free plan includes {FREE_LANG_LIMIT}{' '}
        {FREE_LANG_LIMIT === 1 ? 'language' : 'languages'}.
      </p>
      <Link
        href="/checkout?plan=pro"
        className="shrink-0 rounded-lg bg-gradient-to-r from-neon-amber to-neon-magenta px-3.5 py-1.5 text-xs font-bold text-night-950 transition hover:brightness-110 active:scale-95"
      >
        Upgrade to Pro
      </Link>
    </div>
  );
}
