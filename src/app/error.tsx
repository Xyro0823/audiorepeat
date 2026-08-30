'use client';

import { useEffect } from 'react';
import { reportClientError } from '@/lib/errorMonitoring/client';
import { useT } from '@/lib/i18n';
import StatePanel from '@/components/common/StatePanel';

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
      <StatePanel
        kind="error"
        headingAs="h1"
        title={t('error.generic.title')}
        description={t('error.generic.body')}
        action={
          <>
          <button
            type="button"
            onClick={retry}
            className="min-h-11 rounded-xl bg-neon-cyan px-4 py-2.5 text-sm font-bold text-night-950 transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan"
          >
            {t('common.retry')}
          </button>
          <a
            href="/dashboard"
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/15 px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan"
          >
            {t('dashboard.error.dashboardLink')}
          </a>
          </>
        }
      />
    </main>
  );
}
