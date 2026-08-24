'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { isPlanId, PLANS, type PlanId } from '@/lib/plans';
import { updateSettings } from '@/lib/settingsStore';
import {
  planBillingForEntitlement,
  runSuccessPoll,
  type EntitlementSnapshot,
} from '@/lib/successFlow';
import { useT } from '@/lib/i18n';

interface Props {
  /** Verified paid plan id from the server (display context only); null = nothing verified. */
  planId: string | null;
  billing: string;
  email?: string;
}

/**
 * Checkout success screen.
 *
 * The server entitlement record (written only by the verified Paddle webhook)
 * is the source of truth — reaching this page is NOT proof of payment, and a
 * `transaction_id` query param is at most display context. The page always
 * polls /api/entitlement (even when no transaction_id arrived, e.g. when the
 * redirect carried only the Vercel protection bypass), and mirrors local
 * settings ONLY to the server-confirmed value. A stale or spoofed success
 * page can never grant Pro/Lifetime by itself.
 */
type Phase = 'verifying' | 'activating' | 'active' | 'pending' | 'unverified';

export default function SuccessView({ planId, billing, email }: Props) {
  // No verified plan → start in a neutral "pending" state (never a permanent
  // failure) and let the entitlement poll decide.
  const t = useT();
  const [phase, setPhase] = useState<Phase>(isPlanId(planId) ? 'verifying' : 'pending');
  const [timedOut, setTimedOut] = useState(false);
  const [activePlan, setActivePlan] = useState<PlanId | null>(null);
  const [activeBilling, setActiveBilling] = useState<string | null>(null);
  const handled = useRef(false);

  const plan = isPlanId(planId) ? PLANS[planId] : null;
  const confirmedPlan = activePlan ? PLANS[activePlan] : null;

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;
    let cancelled = false;

    void (async () => {
      const decision = await runSuccessPoll({
        getToken: async () => {
          const { getFirebaseIdToken } = await import('@/lib/firebase/client');
          return getFirebaseIdToken();
        },
        fetchEntitlement: async (token) => {
          try {
            const res = await fetch('/api/entitlement', {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) return null;
            return (await res.json()) as EntitlementSnapshot;
          } catch {
            return null;
          }
        },
      });
      if (cancelled) return;

      if (decision.kind === 'active') {
        // Server confirmed — mirror into local settings (client cache of the
        // server state, not proof in its own right).
        updateSettings({
          plan: decision.plan,
          planBilling: planBillingForEntitlement(decision.plan, decision.billing),
        });
        setActivePlan(decision.plan);
        setActiveBilling(decision.billing);
        setPhase('active');
      } else if (decision.kind === 'unauthenticated') {
        setPhase('unverified');
      } else {
        setTimedOut(true);
        setPhase(isPlanId(planId) ? 'activating' : 'pending');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [planId, billing]);

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-x-clip bg-night-950 px-5 text-[#e8eaef]">
      <div className="pointer-events-none fixed inset-0" aria-hidden>
        <div className="bg-dots absolute inset-0 opacity-60" />
        <div className="absolute inset-0 bg-[radial-gradient(700px_440px_at_50%_-10%,rgba(6,182,212,0.14),transparent_60%)]" />
      </div>

      <div className="glass relative z-10 w-full max-w-lg animate-fade-up rounded-3xl p-8 text-center">
        {phase === 'active' && confirmedPlan ? (
          <>
            <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-neon-green/40 bg-neon-green/10">
              <svg
                viewBox="0 0 24 24"
                className="h-8 w-8 text-neon-green"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="m5 13 4 4L19 7" />
              </svg>
            </span>
            <h1 className="mt-5 text-2xl font-bold tracking-tight text-white">
              {t('checkout.success.welcome', { plan: confirmedPlan.name })}
            </h1>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-slate-400">
              {confirmedPlan.id !== 'lifetime'
                ? t(
                    (activeBilling ?? billing) === 'monthly'
                      ? 'checkout.success.active.monthly'
                      : 'checkout.success.active.annual',
                    { plan: confirmedPlan.name },
                  )
                : t('checkout.success.active.lifetime', { plan: confirmedPlan.name })}
              .{email ? ` ${t('checkout.success.receipt', { email })}` : ''}
            </p>
            <ul className="mx-auto mt-5 max-w-sm space-y-2 text-left">
              {confirmedPlan.features(0).slice(0, 4).map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-slate-300">
                  <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-cyan-500/15">
                    <svg
                      viewBox="0 0 24 24"
                      className="h-2.5 w-2.5 text-cyan-300"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden
                    >
                      <path d="m5 13 4 4L19 7" />
                    </svg>
                  </span>
                  {f}
                </li>
              ))}
            </ul>
            <Link
              href="/dashboard"
              className="btn-primary mt-7 inline-flex h-12 items-center justify-center rounded-xl px-8 text-sm font-semibold text-white"
            >
              {t('checkout.success.startCta')}
            </Link>
          </>
        ) : phase === 'verifying' || phase === 'activating' ? (
          <>
            <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-neon-amber/30 bg-neon-amber/10">
              {phase === 'verifying' ? (
                <span
                  className="inline-block h-7 w-7 animate-spin rounded-full border-2 border-neon-amber/30 border-t-neon-amber"
                  aria-hidden
                />
              ) : (
                <span className="text-2xl" aria-hidden>
                  📬
                </span>
              )}
            </span>
            <h1 className="mt-5 text-2xl font-bold tracking-tight text-white">
              {phase === 'verifying' ? t('checkout.success.verifying') : t('checkout.success.activating')}
            </h1>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-slate-400">
              {phase === 'verifying'
                ? t('checkout.success.verifyingBody', {
                    plan: plan?.name ?? t('checkout.word.plan'),
                  })
                : t('checkout.success.activatingBody')}
            </p>
            <div className="mt-7 flex flex-col gap-2.5">
              <Link
                href="/dashboard"
                className="btn-primary inline-flex h-12 items-center justify-center rounded-xl px-8 text-sm font-semibold text-white"
              >
                {t('checkout.success.goDashboard')}
              </Link>
              {phase === 'activating' && (
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="btn-clean inline-flex h-11 items-center justify-center rounded-xl px-8 text-sm font-medium text-slate-300"
                >
                  {t('checkout.success.checkAgain')}
                </button>
              )}
            </div>
          </>
        ) : phase === 'pending' ? (
          <>
            <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-neon-amber/30 bg-neon-amber/10">
              {timedOut ? (
                <span className="text-2xl" aria-hidden>
                  📬
                </span>
              ) : (
                <span
                  className="inline-block h-7 w-7 animate-spin rounded-full border-2 border-neon-amber/30 border-t-neon-amber"
                  aria-hidden
                />
              )}
            </span>
            <h1 className="mt-5 text-2xl font-bold tracking-tight text-white">
              {timedOut ? t('checkout.success.pendingTimeout') : t('checkout.success.submitted')}
            </h1>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-slate-400">
              {timedOut
                ? t('checkout.success.timeoutBody')
                : t('checkout.success.pendingBody')}
            </p>
            <div className="mt-7 flex flex-col gap-2.5">
              <Link
                href="/dashboard"
                className="btn-primary inline-flex h-12 items-center justify-center rounded-xl px-8 text-sm font-semibold text-white"
              >
                {t('checkout.success.goDashboard')}
              </Link>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="btn-clean inline-flex h-11 items-center justify-center rounded-xl px-8 text-sm font-medium text-slate-300"
              >
                {t('checkout.success.checkAgain')}
              </button>
            </div>
          </>
        ) : (
          <>
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-neon-amber/30 bg-neon-amber/10 text-2xl">
              📩
            </span>
            <h1 className="mt-4 text-xl font-bold tracking-tight text-white">{t('checkout.success.thanksTitle')}</h1>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-slate-400">
              {t('checkout.success.unverifiedBody')}
            </p>
            <Link
              href="/dashboard"
              className="btn-clean mt-7 inline-flex h-11 items-center justify-center rounded-xl px-8 text-sm font-semibold text-white"
            >
              {t('checkout.continueFree')}
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
