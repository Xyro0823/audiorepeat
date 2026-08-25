'use client';

import { useCallback, useRef, useState } from 'react';
import type { AuthUser } from '@/types/auth';
import type { PlanDef } from '@/lib/plans';
import { SUPPORTED_LANGUAGE_COUNT } from '@/lib/freeLang';
import { checkoutSuccessUrl } from '@/lib/checkoutUrl';
import { useT } from '@/lib/i18n';
import { PlanText, planTaglineKey } from '@/lib/i18n/PlanText';

interface Props {
  plan: PlanDef;
  billing: 'monthly' | 'annual';
  signedIn: boolean;
  user: AuthUser | null;
  /** True when NEXT_PUBLIC_PADDLE_CLIENT_TOKEN is set at build time. */
  paddleEnabled: boolean;
  onBack: () => void;
  onContinueFree: () => void;
}

type NotifyState = 'idle' | 'saving' | 'done' | 'error';
type PayState = 'idle' | 'starting' | 'error';

/** Minimal global typings for Paddle.js (loaded from CDN at checkout time). */
declare global {
  interface Window {
    Paddle?: {
      Initialize: (options: { token: string }) => void;
      Environment: {
        set: (environment: 'sandbox' | 'production') => void;
      };
      Checkout: {
        open: (options: {
          settings?: {
            displayMode?: 'overlay' | 'inline';
            theme?: 'light' | 'dark';
            successUrl?: string;
          };
          transactionId?: string;
        }) => void;
      };
    };
  }
}

/** Load Paddle.js once; resolves when window.Paddle is ready. */
function loadPaddleJs(timeoutMs = 8000): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window !== 'undefined' && window.Paddle) {
      resolve();
      return;
    }
    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-paddle-js]',
    );
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('paddle-script-error')), {
        once: true,
      });
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://cdn.paddle.com/paddle/v2/paddle.js';
    script.dataset.paddleJs = 'true';
    script.async = true;
    script.addEventListener('load', () => resolve(), { once: true });
    script.addEventListener('error', () => reject(new Error('paddle-script-error')), {
      once: true,
    });
    document.head.appendChild(script);
    window.setTimeout(() => reject(new Error('paddle-script-timeout')), timeoutMs);
  });
}

/**
 * Payment step — Paddle checkout.
 *
 * Flow: the server creates a Paddle transaction (auth-verified, uid in custom
 * data) via /api/checkout, then this component opens the hosted Paddle
 * checkout overlay with Paddle.js using the transaction id. On completion the
 * customer is redirected to /checkout/success; entitlement is granted only by
 * the /api/paddle/webhook and confirmed via /api/entitlement — never by this
 * screen. When Paddle isn't configured it renders an honest placeholder (no
 * fake card form, nothing charges).
 */
export default function PaymentStep({
  plan,
  billing,
  signedIn,
  user,
  paddleEnabled,
  onBack,
  onContinueFree,
}: Props) {
  const t = useT();
  const { price, note } = plan.priceFor(billing === 'annual');
  const [notify, setNotify] = useState<NotifyState>('idle');
  const [pay, setPay] = useState<PayState>('idle');
  // Refs keep the in-flight guard out of the callback's dep array so its
  // identity stays stable across renders.
  const startingRef = useRef(false);

  // Paddle checkout requires a verified server-side identity — the pay button
  // only appears for signed-in users (the checkout gate already sends
  // anonymous users to sign in first).
  const canPayWithPaddle = paddleEnabled && signedIn && plan.id !== 'basic';

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
      if (!token) throw new Error('no-token');

      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ planId: plan.id, billing }),
      });
      const data = (await res.json()) as {
        transactionId?: string;
        checkoutUrl?: string;
        error?: string;
        message?: string;
      };
      if (!res.ok || !data.transactionId) {
        throw new Error(data.error ?? 'checkout-failed');
      }

      // Open the hosted Paddle checkout overlay for the server-created
      // transaction. On completion Paddle redirects to our success page with
      // ?transaction_id=… appended.
      try {
        await loadPaddleJs();
        const clientToken = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN;
        if (!clientToken || !window.Paddle) throw new Error('paddle-unavailable');
        // Paddle.js defaults to production unless told otherwise — the
        // sandbox account must opt in, or the overlay tries to open a
        // production checkout for a sandbox transaction and shows
        // "Something went wrong". Mirrors the server-side PADDLE_ENV.
        if (process.env.NEXT_PUBLIC_PADDLE_ENV === 'sandbox') {
          window.Paddle.Environment.set('sandbox');
        }
        window.Paddle.Initialize({ token: clientToken });
        window.Paddle.Checkout.open({
          settings: {
            displayMode: 'overlay',
            theme: 'dark',
            successUrl: checkoutSuccessUrl(
              window.location.origin,
              process.env.NEXT_PUBLIC_VERCEL_BYPASS_QUERY,
            ),
          },
          transactionId: data.transactionId,
        });
        // The overlay keeps the user on this page — reset the guard so they
        // can retry if they close it without paying.
        startingRef.current = false;
        setPay('idle');
        return;
      } catch {
        // Paddle.js unavailable (script blocked / token missing) → fall back
        // to the hosted payment link. Entitlement still flows through the
        // webhook regardless of which checkout surface the user pays on.
        if (data.checkoutUrl) {
          window.location.assign(data.checkoutUrl);
          return;
        }
        throw new Error('no-checkout-url');
      }
    } catch {
      startingRef.current = false;
      setPay('error');
    }
  }, [plan.id, billing]);

  return (
    <div className="mx-auto w-full max-w-lg">
      <div className="glass animate-fade-up rounded-3xl p-6">
        <h2 className="text-lg font-semibold tracking-tight text-white">{t('checkout.summary.title')}</h2>

        {/* Summary card */}
        <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-white">{plan.name}</p>
              <p className="mt-0.5 text-xs text-slate-400">{t(planTaglineKey(plan.id))}</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-extrabold tracking-tight text-white">
                ${price}
                <span className="ml-1 text-xs font-medium text-slate-500"><PlanText text={note} /></span>
              </p>
              {plan.id === 'pro' && (
                <p className="mt-0.5 text-[11px] uppercase tracking-wider text-slate-500">
                  {billing === 'annual' ? t('checkout.billing.line.annual') : t('checkout.billing.line.monthly')}
                </p>
              )}
            </div>
          </div>
          <ul className="mt-4 space-y-2 border-t border-white/10 pt-4">
            {plan.features(SUPPORTED_LANGUAGE_COUNT).map((f) => (
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
                  <PlanText text={f} />
                </li>
            ))}
          </ul>
        </div>

        {canPayWithPaddle ? (
          /* ---------------------------------------------------------- */
          /* Real Paddle Checkout — hosted overlay via Paddle.js.        */
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
                  {t('checkout.pay.opening')}
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
                  {t('checkout.pay.amount', { price })}
                  <span className="text-xs font-medium opacity-80">{note}</span>
                </>
              )}
            </button>
            {pay === 'error' && (
              <p className="mt-2 rounded-xl border border-neon-magenta/40 bg-neon-magenta/10 px-3 py-2 text-xs text-neon-magenta">
                {t('checkout.pay.error')}
              </p>
            )}
            <p className="mt-2.5 text-center text-[11px] text-slate-500">
              {t('checkout.pay.securityNote')}
            </p>
          </>
        ) : plan.id === 'basic' ? (
          /* ---------------------------------------------------------- */
          /* Free plan — no payment needed.                               */
          /* ---------------------------------------------------------- */
          <div className="mt-4 rounded-2xl border border-neon-green/30 bg-neon-green/10 p-4">
            <p className="text-sm font-semibold text-neon-green">
              {t('checkout.basic.title')}
            </p>
            <p className="mt-1.5 text-[13px] leading-relaxed text-slate-300">
              {t('checkout.basic.body')}
            </p>
          </div>
        ) : (
          /* ---------------------------------------------------------- */
          /* Honest placeholder — no fake card form, nothing charges.     */
          /* ---------------------------------------------------------- */
          <>
            <div className="mt-4 rounded-2xl border border-neon-amber/30 bg-neon-amber/10 p-4">
              <p className="text-sm font-semibold text-neon-amber">
                {t('checkout.soon.title')}
              </p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-slate-300">
                {t('checkout.soon.body')}
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
                    t('checkout.notify.done')
                  ) : (
                    t('checkout.notify.idle')
                  )}
                </button>
                {notify === 'error' && (
                  <p className="mt-2 text-center text-xs text-neon-magenta">
                    {t('checkout.notify.error')}
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
            {t('checkout.continueFree')}
          </button>
          <button
            type="button"
            onClick={onBack}
            className="btn-clean flex h-11 items-center justify-center rounded-xl px-5 text-sm font-medium text-slate-300"
          >
            {t('checkout.changePlan')}
          </button>
        </div>
      </div>
    </div>
  );
}
