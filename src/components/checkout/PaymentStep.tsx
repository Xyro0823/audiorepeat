'use client';

import { useCallback, useRef, useState } from 'react';
import type { AuthUser } from '@/types/auth';
import type { PlanDef } from '@/lib/plans';

interface Props {
  plan: PlanDef;
  billing: 'monthly' | 'annual';
  signedIn: boolean;
  user: AuthUser | null;
  /** True when NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is set at build time. */
  stripeEnabled: boolean;
  onBack: () => void;
  onContinueFree: () => void;
}

type NotifyState = 'idle' | 'saving' | 'done' | 'error';
type PayState = 'idle' | 'starting' | 'error';

/**
 * Payment step — the swap point for real payments.
 *
 * When Stripe is configured this creates a hosted Checkout Session via the
 * server API and redirects the browser to Stripe's payment page (the secret
 * key never leaves the server). When it isn't, it renders an honest
 * placeholder — plan summary, "payments coming soon" note, and a
 * "notify me" interest-capture action. There is deliberately no credit-card
 * form on this page in either mode; Card/ExpressCheckout UI lives inside
 * Stripe's hosted Checkout.
 */
export default function PaymentStep({
  plan,
  billing,
  signedIn,
  user,
  stripeEnabled,
  onBack,
  onContinueFree,
}: Props) {
  const { price, note } = plan.priceFor(billing === 'annual');
  const [notify, setNotify] = useState<NotifyState>('idle');
  const [pay, setPay] = useState<PayState>('idle');
  // Refs keep the in-flight guard out of the callback's dep array so its
  // identity stays stable across renders.
  const startingRef = useRef(false);

  // Stripe checkout requires a verified server-side identity — the pay button
  // only appears for signed-in users (the checkout gate already sends
  // anonymous users to sign in first).
  const canPayWithStripe = stripeEnabled && signedIn && plan.id !== 'basic';

  const recordInterest = useCallback(async () => {
    if (!user) return;
    setNotify('saving');
    try {
      const { recordPlanInterest } = await import('@/lib/firebase/planInterest');
      await recordPlanInterest(user.id, plan.id, billing);
      setNotify('done');
    } catch {
      // Best-effort capture — a failure never blocks the flow.
      setNotify('error');
    }
  }, [user, plan.id, billing]);

  const startCheckout = useCallback(async () => {
    if (startingRef.current) return;
    startingRef.current = true;
    setPay('starting');
    try {
      // The server verifies this ID token and derives the uid itself — the
      // request body carries no identity at all.
      const { getFirebaseIdToken } = await import('@/lib/firebase/client');
      const token = await getFirebaseIdToken();
      if (!token) {
        startingRef.current = false;
        setPay('error');
        return;
      }
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ planId: plan.id, billing }),
      });
      const data = (await res.json()) as { url?: string; error?: string; message?: string };
      if (!res.ok || !data.url) {
        throw new Error(data.error ?? 'checkout-failed');
      }
      // Hosted Checkout — the browser leaves for Stripe's payment page, then
      // returns to /checkout/success?session_id=… or /checkout?canceled=1.
      window.location.assign(data.url);
    } catch {
      startingRef.current = false;
      setPay('error');
    }
  }, [plan.id, billing]);

  return (
    <div className="mx-auto w-full max-w-lg">
      <div className="glass animate-fade-up rounded-3xl p-6">
        <h2 className="text-lg font-semibold tracking-tight text-white">Your plan</h2>

        {/* Summary card */}
        <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-white">{plan.name}</p>
              <p className="mt-0.5 text-xs text-slate-400">{plan.tagline}</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-extrabold tracking-tight text-white">
                ${price}
                <span className="ml-1 text-xs font-medium text-slate-500">{note}</span>
              </p>
              {plan.id === 'pro' && (
                <p className="mt-0.5 text-[11px] uppercase tracking-wider text-slate-500">
                  {billing === 'annual' ? 'Annual billing' : 'Monthly billing'}
                </p>
              )}
            </div>
          </div>
          <ul className="mt-4 space-y-2 border-t border-white/10 pt-4">
            {plan.features(0).map((f) => (
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
        </div>

        {canPayWithStripe ? (
          /* ---------------------------------------------------------- */
          /* Real Stripe Checkout — hosted payment page via the server.   */
          /* ---------------------------------------------------------- */
          <>
            <button
              type="button"
              onClick={() => void startCheckout()}
              disabled={pay === 'starting'}
              className="btn-primary mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold text-white"
            >
              {pay === 'starting' ? (
                <>
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/25 border-t-white" />
                  Opening secure checkout…
                </>
              ) : (
                <>
                  <svg
                    viewBox="0 0 24 24"
                    className="h-4 w-4"
                    fill="currentColor"
                    aria-hidden
                  >
                    <path d="M12 1.5 3 6v5c0 5 3.9 9.4 9 11.5C17.1 20.4 21 16 21 11V6l-9-4.5ZM10.8 15.3 7 11.5l1.4-1.4 2.4 2.4 4.8-4.8 1.4 1.4-6.2 6.2Z" />
                  </svg>
                  Pay securely with Stripe — ${price}
                  <span className="text-xs font-medium opacity-80">{note}</span>
                </>
              )}
            </button>
            {pay === 'error' && (
              <p className="mt-2 rounded-xl border border-neon-magenta/40 bg-neon-magenta/10 px-3 py-2 text-xs text-neon-magenta">
                Couldn&apos;t start checkout — please try again. You won&apos;t be charged
                unless you complete payment on Stripe&apos;s page.
              </p>
            )}
            <p className="mt-2.5 text-center text-[11px] text-slate-500">
              🔒 Secure payment handled by Stripe — card details never touch AudioRepeat.
            </p>
          </>
        ) : plan.id === 'basic' ? (
          /* ---------------------------------------------------------- */
          /* Free plan — no payment needed.                               */
          /* ---------------------------------------------------------- */
          <div className="mt-4 rounded-2xl border border-neon-green/30 bg-neon-green/10 p-4">
            <p className="text-sm font-semibold text-neon-green">
              🎉 Basic is free — no payment needed
            </p>
            <p className="mt-1.5 text-[13px] leading-relaxed text-slate-300">
              Everything on the Basic plan is yours to use right now. Upgrade to Pro or
              Lifetime whenever you&apos;re ready.
            </p>
          </div>
        ) : (
          /* ---------------------------------------------------------- */
          /* Honest placeholder — no fake card form, nothing charges.     */
          /* ---------------------------------------------------------- */
          <>
            <div className="mt-4 rounded-2xl border border-neon-amber/30 bg-neon-amber/10 p-4">
              <p className="text-sm font-semibold text-neon-amber">
                💳 Payment integration coming soon
              </p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-slate-300">
                AudioRepeat doesn&apos;t charge for anything yet. This screen is where checkout
                will live once payments launch — you won&apos;t be billed today, and nothing here
                processes a payment.
              </p>
            </div>

            {signedIn && (
              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => void recordInterest()}
                  disabled={notify === 'saving' || notify === 'done'}
                  className="btn-clean flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-medium text-slate-200 transition disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {notify === 'saving' ? (
                    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/25 border-t-white" />
                  ) : notify === 'done' ? (
                    "✓ Thanks — we'll let you know when payments go live"
                  ) : (
                    'Notify me when payments launch'
                  )}
                </button>
                {notify === 'error' && (
                  <p className="mt-2 text-center text-xs text-neon-magenta">
                    Couldn&apos;t save that right now — no problem, everything is free for the time being.
                  </p>
                )}
              </div>
            )}
          </>
        )}

        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={onContinueFree}
            className="btn-clean flex h-11 flex-1 items-center justify-center rounded-xl px-5 text-sm font-medium text-slate-300"
          >
            Continue with free access
          </button>
          <button
            type="button"
            onClick={onBack}
            className="btn-clean flex h-11 items-center justify-center rounded-xl px-5 text-sm font-medium text-slate-300"
          >
            Change plan
          </button>
        </div>
      </div>
    </div>
  );
}
