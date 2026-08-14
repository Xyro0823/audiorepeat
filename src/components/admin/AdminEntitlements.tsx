'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { getAuthIdToken } from '@/lib/authStore';
import type { PlanId } from '@/lib/plans';

/** Where the target's plan comes from — returned by the lookup API. */
type EntitlementSource = 'manual' | 'paddle' | null;

interface LookupUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

interface LookupEntitlement {
  plan: PlanId;
  source: EntitlementSource;
  manualExpiresAt: number | null;
  manual: { plan: 'pro' | 'lifetime'; expiresAt: number | null; revoked: boolean } | null;
  providerPlan: PlanId;
}

interface LookupResult {
  user: LookupUser;
  entitlement: LookupEntitlement;
}

type AdminState = 'checking' | 'admin' | 'forbidden' | 'server-error';

const PLAN_LABEL: Record<PlanId, string> = {
  basic: 'Free',
  pro: 'Pro',
  lifetime: 'Lifetime',
};

const REASON_PRESETS = ['Friend gift', 'Beta tester', 'Creator access', 'Support compensation'];

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

/**
 * Admin Gift Pro console — /admin/entitlements.
 *
 * Authorization is 100% server-side: every API call sends the caller's
 * Firebase ID token, and the server verifies it against the `ADMIN_UIDS`
 * allowlist. This page never sees ADMIN_UIDS, never trusts any client flag,
 * and never mutates the target's local plan — grants/revokes write the
 * Firestore `entitlements/{uid}` manual record through the admin API.
 */
export default function AdminEntitlements() {
  const { status, user } = useAuth();
  const [adminState, setAdminState] = useState<AdminState>('checking');

  const [email, setEmail] = useState('');
  const [uidQuery, setUidQuery] = useState('');
  const [lookupBusy, setLookupBusy] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [result, setResult] = useState<LookupResult | null>(null);

  const [grantPlan, setGrantPlan] = useState<'pro' | 'lifetime'>('pro');
  const [grantExpiry, setGrantExpiry] = useState(''); // datetime-local, '' = never
  const [grantReason, setGrantReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

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

  const doLookup = useCallback(
    async (byEmail: string, byUid: string) => {
      const token = await getAuthIdToken();
      if (!token) throw new Error('Not signed in.');
      const params = new URLSearchParams();
      if (byEmail) params.set('email', byEmail);
      else params.set('uid', byUid);
      const res = await fetch(`/api/admin/users/lookup?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await res.json()) as LookupResult & { error?: string };
      if (!res.ok) {
        if (data.error === 'user-not-found') throw new Error('No user found with that identifier.');
        throw new Error(data.error === 'invalid-query' ? 'Enter an email or a UID.' : 'Lookup failed — try again.');
      }
      return data;
    },
    [],
  );

  async function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    setLookupError(null);
    setMessage(null);
    setResult(null);
    if (!email.trim() && !uidQuery.trim()) {
      setLookupError('Enter an email address or a Firebase UID.');
      return;
    }
    setLookupBusy(true);
    try {
      setResult(await doLookup(email.trim(), uidQuery.trim()));
    } catch (err) {
      setLookupError(err instanceof Error ? err.message : 'Lookup failed — try again.');
    } finally {
      setLookupBusy(false);
    }
  }

  async function refreshCard() {
    if (!result) return;
    try {
      const fresh = await doLookup('', result.user.uid);
      if (fresh) setResult(fresh);
    } catch {
      /* keep the last known card on refresh failure */
    }
  }

  async function handleGrant(e: React.FormEvent) {
    e.preventDefault();
    if (!result || busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const token = await getAuthIdToken();
      if (!token) throw new Error('Not signed in.');
      let expiresAt: number | null = null;
      if (grantExpiry.trim()) {
        const ms = Date.parse(grantExpiry.trim());
        if (Number.isNaN(ms)) throw new Error('Pick a valid expiry date.');
        expiresAt = Math.floor(ms / 1000);
      }
      const res = await fetch('/api/admin/entitlements/grant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          uid: result.user.uid,
          plan: grantPlan,
          expiresAt,
          reason: grantReason.trim() || null,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(grantErrorText(data.error));
      setMessage({ kind: 'ok', text: `Granted ${grantPlan === 'lifetime' ? 'Lifetime' : 'Pro'} access.` });
      await refreshCard();
    } catch (err) {
      setMessage({ kind: 'err', text: err instanceof Error ? err.message : 'Grant failed — try again.' });
    } finally {
      setBusy(false);
    }
  }

  async function handleRevoke() {
    if (!result || busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const token = await getAuthIdToken();
      if (!token) throw new Error('Not signed in.');
      const res = await fetch('/api/admin/entitlements/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ uid: result.user.uid }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error === 'no-manual-grant' ? 'No manual grant to revoke.' : 'Revoke failed — try again.');
      setMessage({ kind: 'ok', text: 'Manual grant revoked. The user falls back to their provider plan (or Free).' });
      await refreshCard();
    } catch (err) {
      setMessage({ kind: 'err', text: err instanceof Error ? err.message : 'Revoke failed — try again.' });
    } finally {
      setBusy(false);
    }
  }

  if (status === 'loading') {
    return (
      <main className="flex flex-1 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-neon-cyan/30 border-t-neon-cyan" />
      </main>
    );
  }

  if (status !== 'signed-in') {
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-5 py-10">
        <Card title="Admin · Gift Pro">
          <p className="text-sm text-slate-400">
            Sign in with an admin account to manage Gift Pro entitlements. Guests cannot access this area.
          </p>
        </Card>
      </main>
    );
  }

  if (adminState === 'checking') {
    return (
      <main className="flex flex-1 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-neon-cyan/30 border-t-neon-cyan" />
      </main>
    );
  }

  if (adminState === 'forbidden') {
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-5 py-10">
        <Card title="Admin · Gift Pro">
          <p className="text-sm font-semibold text-neon-amber">403 — You don&apos;t have access to this area.</p>
          <p className="mt-2 text-sm text-slate-400">
            This console is restricted to accounts on the server-side admin allowlist. If you believe this is an
            error, contact the site owner.
          </p>
        </Card>
      </main>
    );
  }

  if (adminState === 'server-error') {
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-5 py-10">
        <Card title="Admin · Gift Pro">
          <p className="text-sm text-slate-400">
            The admin service isn&apos;t ready (server-side auth or the admin allowlist isn&apos;t configured). Try again
            later.
          </p>
        </Card>
      </main>
    );
  }

  const manual = result?.entitlement.manual ?? null;

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-10">
      <header className="mb-6">
        <h1 className="font-display text-xl font-bold text-slate-100">Admin · Gift Pro</h1>
        <p className="mt-1 text-xs text-slate-500">
          Grant Pro/Lifetime access without any Paddle payment. Grants are server-authoritative; the target user
          never needs to be on the admin allowlist.
        </p>
        <a
          href="/admin/diagnostics"
          className="mt-2 inline-block text-xs font-semibold text-neon-cyan underline-offset-2 hover:underline"
        >
          Language diagnostics →
        </a>
      </header>

      <div className="space-y-5">
        <Card title="Find a user">
          <form onSubmit={handleLookup} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Email
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="friend@example.com"
                  className={inputClass}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Firebase UID
                </span>
                <input
                  value={uidQuery}
                  onChange={(e) => setUidQuery(e.target.value)}
                  placeholder="e.g. AbC123xyz…"
                  className={inputClass}
                />
              </label>
            </div>
            <button
              type="submit"
              disabled={lookupBusy}
              className="rounded-lg bg-neon-cyan/90 px-4 py-2 text-sm font-semibold text-night-950 transition hover:bg-neon-cyan disabled:opacity-50"
            >
              {lookupBusy ? 'Looking up…' : 'Look up user'}
            </button>
            {lookupError && <p className="text-xs text-red-400">{lookupError}</p>}
          </form>
        </Card>

        {result && (
          <>
            <Card title="Account">
              <div className="flex items-start gap-3">
                {result.user.photoURL ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={result.user.photoURL}
                    alt=""
                    className="h-10 w-10 rounded-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-sm font-bold text-slate-300">
                    {(result.user.displayName ?? result.user.email ?? '?').slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-100">
                    {result.user.displayName ?? result.user.email ?? result.user.uid}
                  </p>
                  <p className="truncate text-xs text-slate-500">
                    {result.user.email ?? result.user.uid}
                  </p>
                  <p className="mt-1 truncate font-mono text-[10px] text-slate-600">uid: {result.user.uid}</p>
                </div>
              </div>

              <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                <div className="rounded-lg bg-black/25 p-3">
                  <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Effective plan</dt>
                  <dd className="mt-0.5 font-bold text-neon-amber">
                    {PLAN_LABEL[result.entitlement.plan] === 'Free'
                      ? 'Free'
                      : `⭐ ${PLAN_LABEL[result.entitlement.plan]}`}
                  </dd>
                </div>
                <div className="rounded-lg bg-black/25 p-3">
                  <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Source</dt>
                  <dd className="mt-0.5 text-slate-200">
                    {result.entitlement.source === 'manual'
                      ? 'Gift access'
                      : result.entitlement.source === 'paddle'
                        ? 'Paddle (billing)'
                        : '—'}
                  </dd>
                </div>
                <div className="rounded-lg bg-black/25 p-3">
                  <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Manual grant</dt>
                  <dd className="mt-0.5 text-slate-200">
                    {manual
                      ? `${PLAN_LABEL[manual.plan]}${manual.revoked ? ' · revoked' : ''}`
                      : 'None'}
                  </dd>
                  <dd className="text-xs text-slate-500">
                    {manual?.expiresAt ? `Expires ${new Date(manual.expiresAt * 1000).toLocaleDateString()}` : manual ? 'Never expires' : ''}
                  </dd>
                </div>
                <div className="rounded-lg bg-black/25 p-3">
                  <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Provider plan</dt>
                  <dd className="mt-0.5 text-slate-200">{PLAN_LABEL[result.entitlement.providerPlan]}</dd>
                </div>
              </dl>
            </Card>

            <Card title="Grant Gift Pro">
              <form onSubmit={handleGrant} className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-3">
                  <label className="block">
                    <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                      Plan
                    </span>
                    <select
                      value={grantPlan}
                      onChange={(e) => setGrantPlan(e.target.value as 'pro' | 'lifetime')}
                      className={inputClass}
                    >
                      <option value="pro">Pro</option>
                      <option value="lifetime">Lifetime</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                      Expiry
                    </span>
                    <input
                      type="datetime-local"
                      value={grantExpiry}
                      onChange={(e) => setGrantExpiry(e.target.value)}
                      className={inputClass}
                    />
                    <span className="mt-0.5 block text-[10px] text-slate-600">Leave empty = never expires</span>
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                      Reason (internal)
                    </span>
                    <input
                      value={grantReason}
                      onChange={(e) => setGrantReason(e.target.value)}
                      list="gift-reasons"
                      placeholder="Friend gift"
                      className={inputClass}
                    />
                    <datalist id="gift-reasons">
                      {REASON_PRESETS.map((r) => (
                        <option key={r} value={r} />
                      ))}
                    </datalist>
                  </label>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="submit"
                    disabled={busy}
                    className="rounded-lg bg-neon-cyan/90 px-4 py-2 text-sm font-semibold text-night-950 transition hover:bg-neon-cyan disabled:opacity-50"
                  >
                    {busy ? 'Working…' : `Grant ${grantPlan === 'lifetime' ? 'Lifetime' : 'Pro'}`}
                  </button>
                  <button
                    type="button"
                    onClick={handleRevoke}
                    disabled={busy}
                    className="rounded-lg border border-red-400/40 px-4 py-2 text-sm font-semibold text-red-300 transition hover:bg-red-400/10 disabled:opacity-50"
                  >
                    Revoke manual grant
                  </button>
                </div>
                {message && (
                  <p className={`text-xs ${message.kind === 'ok' ? 'text-emerald-400' : 'text-red-400'}`}>
                    {message.text}
                  </p>
                )}
              </form>
            </Card>
          </>
        )}
      </div>
    </main>
  );
}

function grantErrorText(error: string | undefined): string {
  switch (error) {
    case 'invalid-uid':
      return 'The target UID is missing or invalid.';
    case 'invalid-plan':
      return 'Pick Pro or Lifetime.';
    case 'invalid-expiry':
      return 'That expiry is invalid or already in the past.';
    case 'invalid-reason':
      return 'The reason is too long.';
    case 'invalid-body':
      return 'Malformed request.';
    default:
      return 'Grant failed — try again.';
  }
}
