'use client';

import { useEffect } from 'react';
import { reportClientError } from '@/lib/errorMonitoring/client';
import { useT } from '@/lib/i18n';

export default function AppError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  const t = useT();
  useEffect(() => {
    reportClientError(error, 'next-boundary');
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-xl flex-1 items-center px-5 py-12">
      <section className="w-full rounded-3xl border border-white/10 bg-[#10101f] p-6 text-center shadow-2xl">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-neon-magenta/10 text-2xl" aria-hidden>
          ↻
        </div>
        <h1 className="mt-4 font-display text-xl font-bold text-white">{t('error.generic.title')}</h1>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          {t('error.generic.body')}
        </p>
        <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
          <button
            type="button"
            onClick={retry}
            className="rounded-xl bg-neon-cyan px-4 py-2.5 text-sm font-bold text-night-950 transition hover:brightness-110"
          >
            {t('common.retry')}
          </button>
          <a
            href="/dashboard"
            className="rounded-xl border border-white/15 px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-white/5"
          >
            {t('dashboard.error.dashboardLink')}
          </a>
        </div>
      </section>
    </main>
  );
}
