'use client';

import Link from 'next/link';

/**
 * Shared Free-plan lock screen for Pro-only routes (/review, /stats). The
 * route-level component renders this instead of the feature when
 * `planHasFeature(plan, …)` is false, so navigating directly to the URL can't
 * reach the feature — the entry buttons elsewhere merely pre-empt it.
 */
export default function ProFeatureLock({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center px-5 pb-20 pt-16 text-center">
      <section className="glass animate-fade-up w-full rounded-3xl p-8">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-neon-amber/30 bg-neon-amber/10 text-2xl text-neon-amber">
          <svg
            viewBox="0 0 24 24"
            className="h-7 w-7"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <rect x="4" y="11" width="16" height="10" rx="2" />
            <path d="M8 11V7a4 4 0 0 1 8 0v4" />
          </svg>
        </div>
        <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.2em] text-neon-amber">
          Pro feature
        </p>
        <h1 className="mt-2 text-xl font-bold tracking-tight text-white">{title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-400">{description}</p>
        <Link
          href="/checkout?plan=pro"
          className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl bg-gradient-to-r from-neon-cyan to-neon-violet px-6 text-sm font-bold text-night-950 transition hover:brightness-110 active:scale-[0.98]"
        >
          ⭐ Upgrade to Pro
        </Link>
        <p className="mt-3 text-[11px] text-slate-500">
          Free keeps listening drills, dictation and one language with standard voices.
        </p>
      </section>
      <Link
        href="/dashboard"
        className="mt-4 text-sm text-slate-400 underline decoration-slate-600 underline-offset-4 transition hover:text-white"
      >
        Back to practice
      </Link>
    </main>
  );
}
