'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { getAuthIdToken } from '@/lib/authStore';
import AdminBackNav from '@/components/admin/AdminBackNav';
import type { OnboardingSummary, TopItem } from '@/lib/analytics/summary';

type AdminState = 'checking' | 'admin' | 'forbidden' | 'server-error';

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#10101f] p-5">
      <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">{title}</h2>
      {children}
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg bg-black/25 p-3">
      <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-lg font-bold text-white">{value}</dd>
      {sub && <dd className="text-[11px] text-slate-500">{sub}</dd>}
    </div>
  );
}

function TopList({ items }: { items: TopItem[] }) {
  if (items.length === 0) return <p className="text-sm text-slate-600">No events yet.</p>;
  return (
    <ul className="space-y-1">
      {items.map((t) => (
        <li key={t.value} className="flex items-center justify-between gap-3 text-sm">
          <span className="truncate text-slate-200">{t.value}</span>
          <span className="shrink-0 rounded-full bg-white/5 px-2 py-0.5 text-xs text-slate-400">
            {t.count}
          </span>
        </li>
      ))}
    </ul>
  );
}

function SplitBar({ rows }: { rows: Array<{ label: string; count: number; pct: number }> }) {
  const total = rows.reduce((a, b) => a + b.count, 0);
  if (total === 0) return <p className="text-sm text-slate-600">No events yet.</p>;
  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div key={r.label}>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-300">{r.label}</span>
            <span className="text-slate-500">
              {r.count} · {r.pct}%
            </span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/5">
            <div
              className="h-full rounded-full bg-gradient-to-r from-neon-cyan to-neon-violet"
              style={{ width: `${r.pct}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

const STEP_LABELS: Record<string, string> = {
  onboarding_started: 'Started',
  onboarding_language_selected: 'Language picked',
  onboarding_level_selected: 'Level picked',
  onboarding_goal_selected: 'Goal picked',
  onboarding_ready_viewed: 'Ready viewed',
  onboarding_recommended_practice_started: 'Started practice',
  onboarding_dashboard_skipped: 'Skipped to dashboard',
  onboarding_completed: 'Completed',
};

/**
 * Admin Onboarding Analytics — /admin/analytics.
 *
 * Read-only aggregate telemetry: started/completed/completion %, per-step
 * funnel counts, top languages/levels/goals, recommendation-type split and
 * completion-action split. Authorization is 100% server-side (Bearer token →
 * ADMIN_UIDS allowlist via /api/admin/analytics/onboarding); this page never
 * sees admin secrets and never stores anything.
 */
export default function AdminAnalytics() {
  const { status, user } = useAuth();
  const [adminState, setAdminState] = useState<AdminState>('checking');
  const [summary, setSummary] = useState<OnboardingSummary | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Re-check authorization whenever the signed-in user changes; once verified
  // as admin, fetch the summary in the same pass (matches the other admin
  // pages' single-effect pattern — no set-state feedback loops). loadSummary
  // is a stable callback (empty deps), so listing it is safe.
  const loadSummary = useCallback(async (token: string): Promise<void> => {
    setLoadError(null);
    try {
      const res = await fetch('/api/admin/analytics/onboarding', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      const data = (await res.json()) as { summary?: OnboardingSummary; error?: string };
      if (!res.ok) {
        setLoadError(data.error === 'query-failed' ? 'Query failed — try again.' : 'Could not load analytics.');
        return;
      }
      setSummary(data.summary ?? null);
    } catch {
      setLoadError('Could not load analytics.');
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function check() {
      setAdminState('checking');
      if (status !== 'signed-in' || !user) return;
      const token = await getAuthIdToken();
      if (!token) return;
      try {
        const res = await fetch('/api/admin/status', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (cancelled) return;
        if (res.ok) {
          setAdminState('admin');
          await loadSummary(token);
        } else if (res.status === 403) setAdminState('forbidden');
        else setAdminState('server-error');
      } catch {
        if (!cancelled) setAdminState('server-error');
      }
    }
    void check();
    return () => {
      cancelled = true;
    };
  }, [status, user, loadSummary]);

  // User-initiated (Refresh button) — never called from an effect.
  const load = useCallback(async () => {
    const token = await getAuthIdToken();
    if (!token) {
      setLoadError('Not signed in.');
      return;
    }
    await loadSummary(token);
  }, [loadSummary]);

  if (status === 'loading' || adminState === 'checking') {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 px-5 py-10">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-neon-cyan/30 border-t-neon-cyan" />
        <AdminBackNav />
      </main>
    );
  }

  if (status !== 'signed-in') {
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-5 py-10">
        <Card title="Admin · Onboarding Analytics">
          <p className="text-sm text-slate-400">
            Sign in with an admin account to view onboarding analytics. Guests cannot access this area.
          </p>
          <div className="mt-4">
            <AdminBackNav />
          </div>
        </Card>
      </main>
    );
  }

  if (adminState === 'forbidden') {
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-5 py-10">
        <Card title="Admin · Onboarding Analytics">
          <p className="text-sm font-semibold text-neon-amber">403 — You don&apos;t have access to this area.</p>
          <p className="mt-2 text-sm text-slate-400">
            This console is restricted to accounts on the server-side admin allowlist.
          </p>
          <div className="mt-4">
            <AdminBackNav />
          </div>
        </Card>
      </main>
    );
  }

  if (adminState === 'server-error') {
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-5 py-10">
        <Card title="Admin · Onboarding Analytics">
          <p className="text-sm text-slate-400">
            The admin service isn&apos;t ready (server-side auth or the admin allowlist isn&apos;t configured). Try
            again later.
          </p>
          <div className="mt-4">
            <AdminBackNav />
          </div>
        </Card>
      </main>
    );
  }

  const s = summary;

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-10">
      <header className="mb-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-xl font-bold text-slate-100">Admin · Onboarding Analytics</h1>
            <p className="mt-1 text-xs text-slate-500">
              Aggregate, privacy-conscious product telemetry — no user identities are ever stored.
            </p>
          </div>
          <AdminBackNav />
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="mt-2 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:border-white/25 hover:text-white"
        >
          Refresh
        </button>
        {loadError && <p className="mt-2 text-xs text-red-400">{loadError}</p>}
      </header>

      {!s ? (
        <Card title="Loading">
          <p className="text-sm text-slate-500">Fetching the latest summary…</p>
        </Card>
      ) : (
        <div className="space-y-5">
          <Card title={`Onboarding · last ${s.windowDays} days`}>
            <dl className="grid gap-3 sm:grid-cols-3">
              <Stat label="Started" value={String(s.started)} />
              <Stat label="Completed" value={String(s.completed)} />
              <Stat
                label="Completion rate"
                value={s.started > 0 ? `${s.completionPct}%` : '—'}
                sub={s.started > 0 ? undefined : 'No onboarding started in this window'}
              />
            </dl>
          </Card>

          <Card title="Funnel — where users drop off">
            <div className="space-y-2">
              {Object.entries(s.stepCounts).map(([name, count]) => (
                <div key={name} className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-slate-300">{STEP_LABELS[name] ?? name}</span>
                  <span className="shrink-0 rounded-full bg-white/5 px-2 py-0.5 text-xs text-slate-400">
                    {count}
                  </span>
                </div>
              ))}
            </div>
          </Card>

          <div className="grid gap-5 sm:grid-cols-3">
            <Card title="Top languages">
              <TopList items={s.topLanguages} />
            </Card>
            <Card title="Top levels">
              <TopList items={s.topLevels} />
            </Card>
            <Card title="Top goals">
              <TopList items={s.topGoals} />
            </Card>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <Card title="First-practice recommendation">
              <SplitBar
                rows={[
                  { label: 'CEFR level', count: s.recommendation.cefr, pct: s.recommendation.cefrPct },
                  { label: 'Topic', count: s.recommendation.topic, pct: s.recommendation.topicPct },
                  { label: 'Seed', count: s.recommendation.seed, pct: s.recommendation.seedPct },
                ]}
              />
            </Card>
            <Card title="Completion action">
              <SplitBar
                rows={[
                  { label: 'Start practice', count: s.completionAction.practice, pct: s.completionAction.practicePct },
                  { label: 'Go to dashboard', count: s.completionAction.dashboard, pct: s.completionAction.dashboardPct },
                ]}
              />
            </Card>
          </div>
        </div>
      )}
    </main>
  );
}
