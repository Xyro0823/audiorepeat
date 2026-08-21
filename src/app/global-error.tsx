'use client';

import { useEffect } from 'react';
import { reportClientError } from '@/lib/errorMonitoring/client';

export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
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
          <h1 style={{ margin: 0, fontSize: 24 }}>AudioRepeat needs a quick refresh</h1>
          <p style={{ margin: '12px 0 24px', color: '#94a3b8', lineHeight: 1.6 }}>
            Your saved learning data is safe. Retry now to restore the app.
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
            Retry
          </button>
        </main>
      </body>
    </html>
  );
}
