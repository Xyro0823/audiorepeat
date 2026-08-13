'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { isPlanId, PLANS, type PlanId } from '@/lib/plans';
import { updateSettings } from '@/lib/settingsStore';

interface Props {
  /** Verified paid plan id from the server; null = nothing verified. */
  planId: string | null;
  billing: string;
  email?: string;
}

/**
 * Checkout success screen.
 *
 * The webhook / entitlement record is the source of truth — reaching this
 * page is NOT proof of payment. The page shows the order as received and then
 * polls the server entitlement until it reflects the purchased plan (webhook
 * delivery usually beats the redirect, but can lag a few seconds). Local
 * settings are only mirrored to the server-confirmed value, so a stale or
 * spoofed success page can never grant Pro by itself.
 */
export default function SuccessView({ planId, billing, email }: Props) {
  // No verified plan → render the generic fallback from the first paint (no
  // setState inside the effect below).
  const [state, setState] = useState<'verifying' | 'activating' | 'active' | 'unverified'>(
    isPlanId(planId) ? 'verifying' : 'unverified',
  );
  const handled = useRef(false);

  const plan = isPlanId(planId) ? PLANS[planId] : null;

  useEffect(() => {
    if (handled.current || !isPlanId(planId)) return;
    handled.current = true;

    let cancelled = false;
    let attempts = 0;

    const pollEntitlement = async () => {
      if (cancelled) return;
      attempts += 1;
      try {
        const { getFirebaseIdToken } = await import('@/lib/firebase/client');
        const token = await getFirebaseIdToken();
        if (!token) {
          if (!cancelled) setState('unverified');
          return;
        }
        const res = await fetch('/api/entitlement', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = (await res.json()) as { plan?: PlanId };
          if (data.plan === planId) {
            // Server confirmed — mirror into local settings (client cache of
            // the server state, not proof in its own right).
            const cycle = billing === 'monthly' ? 'monthly' : 'annual';
            updateSettings({ plan: planId, planBilling: cycle });
            if (!cancelled) setState('active');
            return;
          }
        }
      } catch {
        /* fall through to retry */
      }
      if (attempts < 15 && !cancelled) {
        // Webhook can lag the redirect by a few seconds — keep polling.
        window.setTimeout(() => void pollEntitlement(), 2000);
      } else if (!cancelled) {
        setState('activating');
      }
    };

    void pollEntitlement();
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
        {state === 'active' && plan ? (
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
              Welcome to {plan.name}!
            </h1>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-slate-400">
              Your {plan.name} plan is active
              {plan.id !== 'lifetime' ? ` (${billing === 'monthly' ? 'monthly' : 'annual'} billing)` : ''}.
              {email ? ` A receipt is on its way to ${email}.` : ''}
            </p>
            <ul className="mx-auto mt-5 max-w-sm space-y-2 text-left">
              {plan.features(0).slice(0, 4).map((f) => (
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
              Start practicing
            </Link>
          </>
        ) : state === 'activating' || state === 'verifying' ? (
          <>
            <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-neon-amber/30 bg-neon-amber/10">
              {state === 'verifying' ? (
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
              {state === 'verifying' ? 'Confirming your payment…' : 'Payment received — activating your plan'}
            </h1>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-slate-400">
              {state === 'verifying'
                ? `We're confirming your ${plan?.name ?? 'plan'} with our payment provider.`
                : 'Your payment went through. Your plan is being activated on our side — this usually takes a few seconds. It may take a moment for all your Pro features to unlock.'}
            </p>
            <div className="mt-7 flex flex-col gap-2.5">
              <Link
                href="/dashboard"
                className="btn-primary inline-flex h-12 items-center justify-center rounded-xl px-8 text-sm font-semibold text-white"
              >
                Go to dashboard
              </Link>
              {state === 'activating' && (
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="btn-clean inline-flex h-11 items-center justify-center rounded-xl px-8 text-sm font-medium text-slate-300"
                >
                  Check again
                </button>
              )}
            </div>
          </>
        ) : (
          <>
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-neon-amber/30 bg-neon-amber/10 text-2xl">
              📩
            </span>
            <h1 className="mt-4 text-xl font-bold tracking-tight text-white">Thanks for your order</h1>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-slate-400">
              We couldn&apos;t verify the payment on this screen, but if you completed a
              checkout, the payment provider will email you a receipt shortly. Everything
              remains free until it&apos;s confirmed.
            </p>
            <Link
              href="/dashboard"
              className="btn-clean mt-7 inline-flex h-11 items-center justify-center rounded-xl px-8 text-sm font-semibold text-white"
            >
              Continue with free access
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
