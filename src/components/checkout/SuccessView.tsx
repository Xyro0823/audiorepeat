'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { isPlanId, PLANS } from '@/lib/plans';
import { updateSettings } from '@/lib/settingsStore';

interface Props {
  /** Verified paid plan id from the server; null = nothing verified. */
  planId: string | null;
  billing: string;
  email?: string;
}

export default function SuccessView({ planId, billing, email }: Props) {
  const { user } = useAuth();
  const handled = useRef(false);

  // Once: persist the purchased plan into the app settings, and (best-effort)
  // record the purchase to Firestore for the admin/analytics record.
  useEffect(() => {
    if (handled.current || !isPlanId(planId)) return;
    handled.current = true;
    const cycle = billing === 'monthly' ? 'monthly' : 'annual';
    updateSettings({ plan: planId, planBilling: cycle });
    if (user) {
      void import('@/lib/firebase/planInterest')
        .then((m) => m.recordPlanPurchase(user.id, planId, billing).catch(() => {}))
        .catch(() => {});
    }
  }, [planId, billing, user]);

  const plan = isPlanId(planId) ? PLANS[planId] : null;

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-x-clip bg-night-950 px-5 text-[#e8eaef]">
      <div className="pointer-events-none fixed inset-0" aria-hidden>
        <div className="bg-dots absolute inset-0 opacity-60" />
        <div className="absolute inset-0 bg-[radial-gradient(700px_440px_at_50%_-10%,rgba(6,182,212,0.14),transparent_60%)]" />
      </div>

      <div className="glass relative z-10 w-full max-w-lg animate-fade-up rounded-3xl p-8 text-center">
        {plan ? (
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
        ) : (
          <>
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-neon-amber/30 bg-neon-amber/10 text-2xl">
              📩
            </span>
            <h1 className="mt-4 text-xl font-bold tracking-tight text-white">Thanks for your order</h1>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-slate-400">
              We couldn&apos;t verify the payment on this screen, but if you completed a
              checkout, Stripe will email you a receipt shortly. Everything remains free
              until then.
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
