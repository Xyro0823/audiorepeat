'use client';

import { useCallback, useEffect, useState } from 'react';
import AdminBackNav from '@/components/admin/AdminBackNav';
import { useAuth } from '@/hooks/useAuth';
import { getAuthIdToken } from '@/lib/authStore';
import type { ErrorMonitoringSummary } from '@/lib/errorMonitoring/admin';
import type { WebhookFailureSummary } from '@/lib/errorMonitoring/webhookFailures';

type AdminState = 'checking' | 'admin' | 'forbidden' | 'server-error';

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-[#10101f] p-5">
      <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">{title}</h2>
      {children}
    </section>
  );
}

function CountList({ rows }: { rows: Array<{ value: string; count: number }> }) {
  if (rows.length === 0) return <p className="text-sm text-slate-600">No captured errors.</p>;
  return (
    <ul className="space-y-2">
      {rows.slice(0, 8).map((row) => (
        <li key={row.value} className="flex items-center justify-between gap-3 text-sm">
          <span className="capitalize text-slate-300">{row.value}</span>
          <span className="rounded-full bg-white/5 px-2 py-0.5 text-xs text-slate-400">{row.count}</span>
        </li>
      ))}
    </ul>
  );
}

export default function AdminErrors() {
  const { status, user } = useAuth();
  const [adminState, setAdminState] = useState<AdminState>('checking');
  const [checkedUid, setCheckedUid] = useState<string | null>(null);
  const [summary, setSummary] = useState<ErrorMonitoringSummary | null>(null);
  const [webhook, setWebhook] = useState<WebhookFailureSummary | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async (expectedUid: string): Promise<void> => {
    setLoadError(null);
    const token = await getAuthIdToken().catch(() => null);
    if (!token) {
      setCheckedUid(expectedUid);
      setAdminState('server-error');
      return;
    }
    try {
      const response = await fetch('/api/admin/diagnostics/errors', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      const data = (await response.json().catch(() => null)) as
        | { summary?: ErrorMonitoringSummary; paddleWebhook?: WebhookFailureSummary; error?: string }
        | null;
      if (response.status === 403) {
        setCheckedUid(expectedUid);
        setAdminState('forbidden');
        return;
      }
      if (!response.ok || !data?.summary) {
        setCheckedUid(expectedUid);
        setAdminState('server-error');
        setLoadError('Error diagnostics are temporarily unavailable.');
        return;
      }
      setSummary(data.summary);
      // Webhook failures are optional in the payload (older API versions);
      // a missing section renders as the healthy "no failures" state.
      setWebhook(
        data.paddleWebhook ?? {
          windowDays: data.summary.windowDays,
          totalEvents: 0,
          totalRecords: 0,
          invalidSignatures: 0,
          truncated: false,
          byEventType: [],
          latest: [],
        },
      );
      setCheckedUid(expectedUid);
      setAdminState('admin');
    } catch {
      setCheckedUid(expectedUid);
      setAdminState('server-error');
      setLoadError('Error diagnostics are temporarily unavailable.');
    }
  }, []);

  useEffect(() => {
    if (status !== 'signed-in' || !user) return;
    const expectedUid = user.id;
    let cancelled = false;
    async function bootstrap() {
      await load(expectedUid);
      if (cancelled) return;
    }
    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, [status, user, load]);

  // Never show a previous account's admin result while a newly signed-in
  // account is being checked. Only a verdict bound to the current uid counts.
  const visibleAdminState = user && checkedUid === user.id ? adminState : 'checking';

  if (status === 'loading' || (status === 'signed-in' && visibleAdminState === 'checking')) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 px-5 py-10">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-neon-cyan/30 border-t-neon-cyan" />
        <p className="text-sm text-slate-400">Checking admin access…</p>
        <AdminBackNav />
      </main>
    );
  }

  if (status !== 'signed-in' || visibleAdminState === 'forbidden') {
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-5 py-10">
        <Card title="Admin · Error Diagnostics">
          <p className="text-sm text-neon-amber">
            {status !== 'signed-in'
              ? 'Sign in with an admin account to view this area.'
              : '403 — This area is restricted to the server-side admin allowlist.'}
          </p>
          <div className="mt-4"><AdminBackNav /></div>
        </Card>
      </main>
    );
  }

  if (visibleAdminState === 'server-error') {
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-5 py-10">
        <Card title="Admin · Error Diagnostics">
          <p className="text-sm text-slate-400">{loadError ?? 'The admin service is not ready.'}</p>
          <button
            type="button"
            onClick={() => user && void load(user.id)}
            className="mt-4 rounded-lg bg-neon-cyan px-4 py-2 text-sm font-semibold text-night-950"
          >
            Try again
          </button>
          <div className="mt-4"><AdminBackNav /></div>
        </Card>
      </main>
    );
  }

  const data = summary;
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-10">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold text-white">Admin · Error Diagnostics</h1>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500">
            Privacy-safe classifications only. Messages, stacks, URLs, user identities, IPs and tokens are never stored.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => user && void load(user.id)}
            className="rounded-lg border border-white/15 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/5"
          >
            Refresh
          </button>
          <AdminBackNav />
        </div>
      </header>

      {!data ? (
        <Card title="Loading"><p className="text-sm text-slate-500">Fetching recent errors…</p></Card>
      ) : (
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <Card title={`Captured · ${data.windowDays} days`}>
              <p className="text-3xl font-bold text-white">{data.total}{data.truncated ? '+' : ''}</p>
            </Card>
            <Card title="Offline at capture">
              <p className="text-3xl font-bold text-neon-amber">{data.offline}</p>
            </Card>
            <Card title="Retention">
              <p className="text-sm font-semibold text-neon-green">30-day TTL ready</p>
            </Card>
          </div>

          {webhook && (
            <Card
              title={`Paddle webhooks · ${webhook.windowDays} days`}
            >
              {webhook.totalEvents === 0 ? (
                <div className="flex items-center gap-2">
                  <span aria-hidden className="text-lg text-neon-green">✓</span>
                  <p className="text-sm font-semibold text-neon-green">
                    All webhook events processed — no failures recorded.
                  </p>
                </div>
              ) : (
                <>
                  <p className="text-sm font-semibold text-neon-magenta">
                    {webhook.totalEvents} failed webhook processing{webhook.totalEvents === 1 ? '' : 's'}
                    {webhook.truncated ? ' (list truncated)' : ''}
                  </p>
                  <CountList rows={webhook.byEventType} />
                  {webhook.latest.length > 0 && (
                    <div className="mt-4 overflow-x-auto">
                      <table className="w-full min-w-[560px] text-left text-xs">
                        <thead className="text-slate-500">
                          <tr className="border-b border-white/10">
                            <th className="pb-2 font-semibold">Last failure</th>
                            <th className="pb-2 font-semibold">Event type</th>
                            <th className="pb-2 font-semibold">Kind</th>
                            <th className="pb-2 font-semibold">Stage</th>
                            <th className="pb-2 font-semibold">Class</th>
                            <th className="pb-2 font-semibold">Retries</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 text-slate-300">
                          {webhook.latest.map((row) => (
                            <tr key={row.id}>
                              <td className="py-2 pr-4 text-slate-500">{new Date(row.updatedAt).toLocaleString()}</td>
                              <td className="py-2 pr-4">{row.eventType}</td>
                              <td className="py-2 pr-4">{row.kind}</td>
                              <td className="py-2 pr-4">{row.stage}</td>
                              <td className="py-2 pr-4">{row.errorName}</td>
                              <td className="py-2 tabular-nums">{row.count}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </Card>
          )}

          <div className="grid gap-5 sm:grid-cols-2">
            <Card title="By product area"><CountList rows={data.byArea} /></Card>
            <Card title="By safe error class"><CountList rows={data.byErrorName} /></Card>
          </div>
          <Card title="Latest sanitized events">
            {data.latest.length === 0 ? (
              <p className="text-sm text-slate-600">No errors captured in this window.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[680px] text-left text-xs">
                  <thead className="text-slate-500">
                    <tr className="border-b border-white/10">
                      <th className="pb-2 font-semibold">Time</th>
                      <th className="pb-2 font-semibold">Area</th>
                      <th className="pb-2 font-semibold">Class</th>
                      <th className="pb-2 font-semibold">Source</th>
                      <th className="pb-2 font-semibold">Fingerprint</th>
                      <th className="pb-2 font-semibold">Release</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-slate-300">
                    {data.latest.map((event) => (
                      <tr key={event.id}>
                        <td className="py-2 pr-4 text-slate-500">{new Date(event.createdAt).toLocaleString()}</td>
                        <td className="py-2 pr-4 capitalize">{event.area}</td>
                        <td className="py-2 pr-4">{event.errorName}</td>
                        <td className="py-2 pr-4">{event.source}</td>
                        <td className="py-2 pr-4 font-mono text-slate-500">{event.fingerprint}</td>
                        <td className="py-2 font-mono text-slate-500">{event.release}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}
    </main>
  );
}
