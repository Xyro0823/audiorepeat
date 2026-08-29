import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Shared shell for the public legal pages (Privacy, Terms, Refunds).
 *
 * Pure server component — no hooks, no auth, no client state — so the legal
 * pages stay fully public and lightweight. Provides a consistent AudioRepeat
 * look, a clear path back to the main site, and a footer that cross-links the
 * three legal documents.
 */
export default function LegalShell({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh w-full flex-1 flex-col bg-night-950">
      {/* Header */}
      <header className="border-b border-white/5 bg-night-950">
        <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center justify-between gap-3 px-5 py-5">
          <Link href="/dashboard" scroll={false} className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-cyan-400/30 bg-gradient-to-br from-cyan-500/20 to-blue-600/10">
              <svg
                viewBox="0 0 24 24"
                className="h-4 w-4 text-cyan-300"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M8 5.5v13a1 1 0 0 0 1.5.87l11-6.5a1 1 0 0 0 0-1.74l-11-6.5A1 1 0 0 0 8 5.5Z" />
              </svg>
            </span>
            <span className="text-base font-extrabold tracking-tight text-white">
              Audio<span className="text-cyan-400">Repeat</span>
            </span>
          </Link>
          <Link
            href="/dashboard"
            scroll={false}
            className="text-[13px] font-medium text-slate-400 transition hover:text-white"
          >
            ← Dashboard руу буцах
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-10 sm:py-14">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-400">
          Last updated: {updated}
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">
          {title}
        </h1>
        <div className="mt-8 space-y-8 text-[15px] leading-relaxed text-slate-300">
          {children}
        </div>
      </main>

      {/* Footer — legal cross-links + home */}
      <footer className="border-t border-white/5 bg-night-950">
        <div className="mx-auto flex w-full max-w-3xl flex-col items-center justify-between gap-4 px-5 py-7 sm:flex-row">
          <p className="text-xs text-slate-500">
            © 2026 AudioRepeat · Loop, repeat, retain.
          </p>
          <nav
            aria-label="Legal"
            className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-slate-400"
          >
            <Link href="/privacy" className="transition hover:text-cyan-300">
              Privacy Policy
            </Link>
            <Link href="/terms" className="transition hover:text-cyan-300">
              Terms
            </Link>
            <Link href="/refunds" className="transition hover:text-cyan-300">
              Refund Policy
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
