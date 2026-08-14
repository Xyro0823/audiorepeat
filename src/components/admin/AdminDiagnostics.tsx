'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { getAuthIdToken } from '@/lib/authStore';
import type { HealthReport, TermErrorRow, VariantRow } from '@/lib/vocabHealth';
import { packLangLabel } from '@/lib/starterSets';
import {
  filterConceptRows,
  filterVariants,
  languageSummary,
  topicConceptRows,
  type RowFilter,
} from '@/lib/adminDiagnostics';

type AdminState = 'checking' | 'admin' | 'forbidden' | 'server-error';
type LoadState = 'idle' | 'loading' | 'ready' | 'error';

/** Fetch the admin-only diagnostics report. Throws on non-2xx / no token. */
async function fetchDiagnosticsReport(): Promise<HealthReport> {
  const token = await getAuthIdToken();
  if (!token) throw new Error('Not signed in.');
  const res = await fetch('/api/admin/diagnostics/languages', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = (await res.json()) as HealthReport & { error?: string };
  if (!res.ok) {
    throw new Error(
      data.error === 'diagnostics-unavailable'
        ? 'Diagnostics data is unavailable.'
        : 'Failed to load diagnostics — try again.',
    );
  }
  return data;
}

const inputClass =
  'w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-slate-200 placeholder-slate-500 outline-none transition focus:border-neon-cyan/50';

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#10101f] p-5">
      <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">{title}</h2>
      {children}
    </div>
  );
}

function StatCard({ label, value, tone }: { label: string; value: string; tone?: 'ok' | 'warn' | 'bad' }) {
  const color =
    tone === 'bad'
      ? 'text-red-400'
      : tone === 'warn'
        ? 'text-neon-amber'
        : tone === 'ok'
          ? 'text-neon-green'
          : 'text-slate-100';
  return (
    <div className="rounded-2xl border border-white/10 bg-[#10101f] p-4">
      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`mt-1 font-display text-2xl font-bold ${color}`}>{value}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: 'MATCH' | 'VARIANT' | 'TOPIC-ONLY' }) {
  const cls =
    status === 'MATCH'
      ? 'border-neon-green/40 bg-neon-green/10 text-neon-green'
      : status === 'VARIANT'
        ? 'border-neon-amber/40 bg-neon-amber/10 text-neon-amber'
        : 'border-white/15 bg-white/5 text-slate-400';
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${cls}`}>
      {status}
    </span>
  );
}

const FILTERS: Array<{ key: RowFilter | 'errors'; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'MATCH', label: 'MATCH' },
  { key: 'VARIANT', label: 'VARIANT' },
  { key: 'TOPIC-ONLY', label: 'TOPIC-ONLY' },
  { key: 'errors', label: 'Errors' },
];

/**
 * Admin Language Diagnostics — /admin/diagnostics.
 *
 * Authorization is 100% server-side: the page first verifies admin status via
 * /api/admin/status, then fetches the diagnostics report from
 * /api/admin/diagnostics/languages — both send the caller's Firebase ID
 * token, and the server verifies it against the ADMIN_UIDS allowlist. The
 * report is the same vocabulary/language analysis the developer vocab:health
 * CLI produces; it contains language data only (no user records, credentials
 * or secrets).
 */
export default function AdminDiagnostics() {
  const { status, user } = useAuth();
  const [adminState, setAdminState] = useState<AdminState>('checking');
  const [loadState, setLoadState] = useState<LoadState>('idle');
  const [report, setReport] = useState<HealthReport | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [lang, setLang] = useState('');
  const [topic, setTopic] = useState('');
  const [filter, setFilter] = useState<RowFilter | 'errors'>('all');
  const [search, setSearch] = useState('');
  const [variantSearch, setVariantSearch] = useState('');

  // Re-check authorization whenever the signed-in user changes.
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
        if (res.ok) setAdminState('admin');
        else if (res.status === 403) setAdminState('forbidden');
        else setAdminState('server-error');
      } catch {
        if (!cancelled) setAdminState('server-error');
      }
    }
    void check();
    return () => {
      cancelled = true;
    };
  }, [status, user]);

  const loadReport = useCallback(async () => {
    setLoadState('loading');
    setLoadError(null);
    try {
      const fresh = await fetchDiagnosticsReport();
      setReport(fresh);
      setLoadState('ready');
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load diagnostics — try again.');
      setLoadState('error');
    }
  }, []);

  // Load once the page confirms admin access. The setState calls happen inside
  // a locally-declared async function (same pattern as AdminEntitlements) —
  // never synchronously in the effect body (react-hooks/set-state-in-effect).
  useEffect(() => {
    if (adminState !== 'admin' || loadState !== 'idle') return;
    let cancelled = false;
    async function load() {
      await loadReport();
      if (cancelled) return;
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [adminState, loadState, loadReport]);

  const langLabel = (code: string) => packLangLabel(code);

  const languageNames = useMemo(
    () => (report ? Object.keys(report.perLanguage) : []),
    [report],
  );

  const topics = useMemo(() => (report ? report.topicDetails.map((t) => t.id) : []), [report]);

  const langSummary = useMemo(
    () => (report && lang ? languageSummary(report, lang) : null),
    [report, lang],
  );

  const selectedTopic = useMemo(
    () => (report && topic ? report.topicDetails.find((t) => t.id === topic) ?? null : null),
    [report, topic],
  );

  const conceptRows = useMemo(
    () => (report && topic && lang ? topicConceptRows(report, topic, lang) : null),
    [report, topic, lang],
  );

  const tableRows = useMemo(() => {
    if (!conceptRows) return null;
    if (filter === 'errors') {
      // Errors = hard terminology violations only; ordinary VARIANT rows are
      // never errors.
      return [];
    }
    return filterConceptRows(conceptRows, filter as RowFilter, search);
  }, [conceptRows, filter, search]);

  const variantRows = useMemo(
    () =>
      report
        ? filterVariants(report, {
            lang: lang || undefined,
            topic: topic || undefined,
            search: variantSearch,
            limit: 500,
          })
        : [],
    [report, lang, topic, variantSearch],
  );

  if (status === 'loading' || (status === 'signed-in' && adminState === 'checking')) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-neon-cyan/30 border-t-neon-cyan" />
      </main>
    );
  }

  if (status !== 'signed-in') {
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-5 py-10">
        <Card title="Admin · Language Diagnostics">
          <p className="text-sm text-slate-400">
            Sign in with an admin account to inspect language/vocabulary health. Guests cannot access this area.
          </p>
        </Card>
      </main>
    );
  }

  if (adminState === 'forbidden') {
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-5 py-10">
        <Card title="Admin · Language Diagnostics">
          <p className="text-sm font-semibold text-neon-amber">403 — You don&apos;t have access to this area.</p>
          <p className="mt-2 text-sm text-slate-400">
            This page is restricted to accounts on the server-side admin allowlist.
          </p>
        </Card>
      </main>
    );
  }

  if (adminState === 'server-error') {
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-5 py-10">
        <Card title="Admin · Language Diagnostics">
          <p className="text-sm text-slate-400">
            The admin service isn&apos;t ready (server-side auth or the admin allowlist isn&apos;t configured). Try again
            later.
          </p>
        </Card>
      </main>
    );
  }

  const counts = report?.counts;
  const healthy = report ? report.failures.length === 0 : false;
  const warnings = report?.warnings.length ?? 0;

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-10">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold text-slate-100">Admin · Language Diagnostics</h1>
          <p className="mt-1 text-xs text-slate-500">
            Live vocabulary/topic health from the same analysis the <code className="font-mono">vocab:health</code> CLI
            runs. Read-only — nothing here changes data.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadReport()}
          disabled={loadState === 'loading'}
          className="rounded-lg border border-white/15 px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:bg-white/5 disabled:opacity-50"
        >
          {loadState === 'loading' ? 'Refreshing…' : 'Refresh'}
        </button>
      </header>

      {loadState === 'loading' && (
        <div className="mb-6 flex items-center gap-2 text-sm text-slate-400">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-neon-cyan/30 border-t-neon-cyan" />
          Loading diagnostics…
        </div>
      )}

      {loadState === 'error' && (
        <div className="mb-6 rounded-2xl border border-red-400/30 bg-red-400/5 p-4 text-sm text-red-300">
          {loadError}
        </div>
      )}

      {loadState === 'ready' && report && (
        <>
          {/* Status banner */}
          <div
            className={`mb-6 rounded-2xl border p-4 text-sm ${
              healthy
                ? warnings > 0
                  ? 'border-neon-amber/30 bg-neon-amber/5 text-neon-amber'
                  : 'border-neon-green/30 bg-neon-green/5 text-neon-green'
                : 'border-red-400/30 bg-red-400/5 text-red-300'
            }`}
          >
            {healthy ? (
              <>
                <span className="font-bold">{warnings > 0 ? 'Healthy — with warnings' : 'Healthy'}</span>
                <span className="opacity-80"> · {warnings > 0 ? `${warnings} near-threshold warning${warnings === 1 ? '' : 's'}` : 'all hard invariants pass'} · 0 hard errors</span>
              </>
            ) : (
              <>
                <span className="font-bold">Issues detected</span>
                <span className="opacity-80"> · {report.failures.length} hard failure{report.failures.length === 1 ? '' : 's'}</span>
              </>
            )}
          </div>

          {/* Summary cards */}
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Pack languages" value={String(counts?.packLanguages)} />
            <StatCard label="Bank files" value={String(counts?.bankFiles)} />
            <StatCard label="Vocabulary pairs" value={(counts?.totalVocabPairs ?? 0).toLocaleString()} />
            <StatCard label="Topics" value={String(counts?.topics)} />
            <StatCard label="Topic languages" value={String(counts?.topicLanguages)} />
            <StatCard label="Topic pairs" value={(counts?.totalTopicPairs ?? 0).toLocaleString()} />
            <StatCard label="Hard errors" value={String(report.hardErrorRows.length)} tone={report.hardErrorRows.length ? 'bad' : 'ok'} />
            <StatCard label="Variants" value={report.variantRows.length.toLocaleString()} tone="warn" />
          </div>

          {/* Selectors */}
          <div className="mb-6 grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Language
              </span>
              <select value={lang} onChange={(e) => setLang(e.target.value)} className={inputClass}>
                <option value="">All languages</option>
                {languageNames.map((code) => (
                  <option key={code} value={code}>
                    {langLabel(code)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Topic
              </span>
              <select value={topic} onChange={(e) => setTopic(e.target.value)} className={inputClass}>
                <option value="">All topics</option>
                {topics.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {/* Language detail */}
          {langSummary && (
            <div className="mb-6 space-y-5">
              <Card title={`Language · ${langLabel(langSummary.lang)}`}>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-lg bg-black/25 p-3">
                    <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-500">A1–C2 pack counts</dt>
                    <dd className="mt-1 flex flex-wrap gap-1.5">
                      {langSummary.levels.map(([lvl, n]) => (
                        <span key={lvl} className="rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono text-xs text-slate-200">
                          {lvl} {n}
                        </span>
                      ))}
                    </dd>
                  </div>
                  <div className="rounded-lg bg-black/25 p-3">
                    <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Worst overlap</dt>
                    <dd className="mt-1 text-sm text-slate-200">
                      target {langSummary.worstTargetOverlap}% ({langSummary.worstTargetPair}) · pair {langSummary.worstPairOverlap}% (
                      {langSummary.worstPairPair})
                    </dd>
                  </div>
                  <div className="rounded-lg bg-black/25 p-3">
                    <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Topics</dt>
                    <dd className="mt-1 text-sm text-slate-200">
                      {langSummary.topicsCovered}/{counts?.topics} covered · {langSummary.totalTopicPairs.toLocaleString()} pairs
                    </dd>
                  </div>
                </div>
                <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-4">
                  <div className="rounded-lg bg-black/25 p-3">
                    <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Total words</dt>
                    <dd className="mt-0.5 text-slate-200">{langSummary.totalWords.toLocaleString()}</dd>
                  </div>
                  <div className="rounded-lg bg-black/25 p-3">
                    <dt className="text-[10px] font-bold uppercase tracking-wider text-neon-green">MATCH</dt>
                    <dd className="mt-0.5 text-neon-green">{langSummary.matches}</dd>
                  </div>
                  <div className="rounded-lg bg-black/25 p-3">
                    <dt className="text-[10px] font-bold uppercase tracking-wider text-neon-amber">VARIANT</dt>
                    <dd className="mt-0.5 text-neon-amber">{langSummary.variants}</dd>
                  </div>
                  <div className="rounded-lg bg-black/25 p-3">
                    <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-400">TOPIC-ONLY</dt>
                    <dd className="mt-0.5 text-slate-300">{langSummary.topicOnly}</dd>
                  </div>
                </dl>
              </Card>
            </div>
          )}

          {/* Topic detail */}
          {selectedTopic && (
            <div className="mb-6">
              <Card title={`Topic · ${selectedTopic.id}`}>
                <div className="mb-3 flex flex-wrap gap-2 text-xs text-slate-400">
                  <span className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5">
                    {selectedTopic.coreSize} concepts
                  </span>
                  <span className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5">
                    {selectedTopic.languages} languages
                  </span>
                  <span className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5">
                    {selectedTopic.totalPairs.toLocaleString()} pairs
                  </span>
                  <span
                    className={`rounded-md border px-2 py-0.5 font-bold ${
                      selectedTopic.parityStatus === 'OK'
                        ? 'border-neon-green/40 bg-neon-green/10 text-neon-green'
                        : 'border-red-400/40 bg-red-400/10 text-red-300'
                    }`}
                  >
                    {selectedTopic.parityStatus}
                  </span>
                </div>
                {selectedTopic.issues.length > 0 && (
                  <ul className="mb-3 space-y-1 text-xs text-red-300">
                    {selectedTopic.issues.map((i) => (
                      <li key={i}>· {i}</li>
                    ))}
                  </ul>
                )}
                <div className="max-h-56 overflow-y-auto rounded-lg bg-black/25 p-3">
                  <div className="grid grid-cols-1 gap-x-6 sm:grid-cols-2 lg:grid-cols-3">
                    {selectedTopic.core.map((c, i) => (
                      <div key={c} className="flex gap-2 py-0.5 font-mono text-xs text-slate-300">
                        <span className="w-6 text-right text-slate-600">{i + 1}.</span>
                        <span>{c}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            </div>
          )}

          {/* Topic + language concept table */}
          {selectedTopic && lang && (
            <div className="mb-6">
              <Card title={`Concepts · ${selectedTopic.id} / ${langLabel(lang)}`}>
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  {FILTERS.map((f) => (
                    <button
                      key={f.key}
                      type="button"
                      onClick={() => setFilter(f.key)}
                      className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                        filter === f.key
                          ? f.key === 'errors'
                            ? 'border-red-400/60 bg-red-400/10 text-red-300'
                            : 'border-neon-cyan/60 bg-neon-cyan/10 text-neon-cyan'
                          : 'border-white/10 bg-white/5 text-slate-400 hover:bg-white/10'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search English or target…"
                    className={`${inputClass} ml-auto max-w-xs`}
                  />
                </div>

                {filter === 'errors' ? (
                  <p className="text-sm text-slate-400">
                    {report.hardErrorRows.length === 0
                      ? 'No hard terminology errors.'
                      : `${report.hardErrorRows.length} hard error${report.hardErrorRows.length === 1 ? '' : 's'} found.`}
                  </p>
                ) : tableRows && tableRows.length > 0 ? (
                  <div className="max-h-96 overflow-y-auto rounded-lg border border-white/10">
                    <table className="w-full text-left text-sm">
                      <thead className="sticky top-0 bg-[#15152a] text-[10px] uppercase tracking-wider text-slate-500">
                        <tr>
                          <th className="px-3 py-2">#</th>
                          <th className="px-3 py-2">English</th>
                          <th className="px-3 py-2">Target</th>
                          <th className="px-3 py-2">Bank</th>
                          <th className="px-3 py-2">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tableRows.map((r) => (
                          <tr key={r.index} className="border-t border-white/5 text-slate-200">
                            <td className="px-3 py-1.5 font-mono text-xs text-slate-500">{r.index}</td>
                            <td className="px-3 py-1.5">{r.english}</td>
                            <td className="px-3 py-1.5">{r.target}</td>
                            <td className="px-3 py-1.5 font-mono text-xs text-slate-400">
                              {r.levels.length ? r.levels.join(', ') : '—'}
                            </td>
                            <td className="px-3 py-1.5">
                              <StatusBadge status={r.status} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">No rows match this filter.</p>
                )}
              </Card>
            </div>
          )}

          {/* Variant review */}
          <div className="mb-6">
            <Card title="Variant review (human review only — not errors)">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <input
                  value={variantSearch}
                  onChange={(e) => setVariantSearch(e.target.value)}
                  placeholder="Search English, topic target or bank target…"
                  className={`${inputClass} max-w-md`}
                />
                <span className="ml-auto text-xs text-slate-500">
                  {variantRows.length === 500 ? 'showing first 500 of ' : ''}
                  {variantRows.length.toLocaleString()} matching
                </span>
              </div>
              {variantRows.length === 0 ? (
                <p className="text-sm text-slate-500">No VARIANT rows match.</p>
              ) : (
                <div className="max-h-96 overflow-y-auto rounded-lg border border-white/10">
                  <table className="w-full text-left text-sm">
                    <thead className="sticky top-0 bg-[#15152a] text-[10px] uppercase tracking-wider text-slate-500">
                      <tr>
                        <th className="px-3 py-2">Language</th>
                        <th className="px-3 py-2">Topic</th>
                        <th className="px-3 py-2">English</th>
                        <th className="px-3 py-2">Topic target</th>
                        <th className="px-3 py-2">Bank target(s)</th>
                        <th className="px-3 py-2">Levels</th>
                      </tr>
                    </thead>
                    <tbody>
                      {variantRows.map((r: VariantRow, i) => (
                        <tr key={`${r.lang}-${r.topic}-${r.english}-${i}`} className="border-t border-white/5 text-slate-200">
                          <td className="px-3 py-1.5 text-xs">{langLabel(r.lang)}</td>
                          <td className="px-3 py-1.5 text-xs">{r.topic}</td>
                          <td className="px-3 py-1.5">{r.english}</td>
                          <td className="px-3 py-1.5">{r.topicTarget}</td>
                          <td className="px-3 py-1.5 text-slate-400">{(r.bankTargets ?? []).join(', ') || '—'}</td>
                          <td className="px-3 py-1.5 font-mono text-xs text-slate-400">{(r.levels ?? []).join(', ')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>

          {/* Hard errors */}
          <div>
            <Card title="Hard terminology errors">
              {report.hardErrorRows.length === 0 ? (
                <p className="text-sm text-neon-green">Hard terminology errors: 0 — data is clean.</p>
              ) : (
                <ul className="space-y-2">
                  {report.hardErrorRows.map((e: TermErrorRow, i) => (
                    <li key={i} className="rounded-lg border border-red-400/30 bg-red-400/5 p-3 text-sm text-red-300">
                      <span className="font-semibold">{e.pack}</span> · {e.source} · “{e.english}” → “
                      {e.target}” (expected “{e.expected}”)
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </>
      )}
    </main>
  );
}
