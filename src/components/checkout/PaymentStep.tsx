'use client';

import { useCallback, useState } from 'react';
import type { AuthUser } from '@/types/auth';
import type { PlanDef } from '@/lib/plans';

interface Props {
  plan: PlanDef;
  billing: 'monthly' | 'annual';
  signedIn: boolean;
  user: AuthUser | null;
  onBack: () => void;
  onContinueFree: () => void;
}

type NotifyState = 'idle' | 'saving' | 'done' | 'error';

/**
 * Payment step — the swap point for a real Stripe integration.
 *
 * Today there is no payment provider, so this renders an honest placeholder:
 * a plan summary, an explicit "payments are coming soon" note, and a
 * "notify me" interest-capture action. There is deliberately NO credit-card
 * form — nothing here pretends to charge the user.
 *
 * When Stripe (or another provider) is wired in, replace the placeholder
 * body below with the checkout form while keeping the same props/contract,
 * so the surrounding flow (plan select → auth → pay) stays untouched.
 */
export default function PaymentStep({
  plan,
  billing,
  signedIn,
  user,
  onBack,
  onContinueFree,
}: Props) {
  const { price, note } = plan.priceFor(billing === 'annual');
  const [notify, setNotify] = useState<NotifyState>('idle');

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

        {/* Honest placeholder — no fake card form, nothing pretends to charge. */}
        <div className="mt-4 rounded-2xl border border-neon-amber/30 bg-neon-amber/10 p-4">
          <p className="text-sm font-semibold text-neon-amber">
            💳 Payment integration coming soon
          </p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-slate-300">
            AudioRepeat doesn&apos;t charge for anything yet. This screen is where checkout will
            live once payments launch — you won&apos;t be billed today, and nothing here processes a
            payment.
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
                '✓ Thanks — we\'ll let you know when payments go live'
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

        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={onContinueFree}
            className="btn-primary flex h-11 flex-1 items-center justify-center rounded-xl px-5 text-sm font-semibold text-white"
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
