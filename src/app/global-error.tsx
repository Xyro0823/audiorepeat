'use client';

import { useEffect } from 'react';
import { reportClientError } from '@/lib/errorMonitoring/client';
// Safe even though global-error renders outside providers: useT reads the
// module settings store, whose snapshot defaults to English before hydration.
import { useT } from '@/lib/i18n';

export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  const t = useT();
  useEffect(() => {
    reportClientError(error, 'global-boundary');
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          padding: 24,
          boxSizing: 'border-box',
          background: '#05050c',
          color: '#f8fafc',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <main style={{ width: 'min(100%, 520px)', textAlign: 'center' }}>
          <h1 style={{ margin: 0, fontSize: 24 }}>{t('error.generic.title')}</h1>
          <p style={{ margin: '12px 0 24px', color: '#94a3b8', lineHeight: 1.6 }}>
            {t('error.generic.body')}
          </p>
          <button
            type="button"
            onClick={retry}
            style={{
              border: 0,
              borderRadius: 12,
              padding: '11px 20px',
              background: '#22e4ff',
              color: '#05050c',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {t('common.retry')}
          </button>
        </main>
      </body>
    </html>
  );
}
