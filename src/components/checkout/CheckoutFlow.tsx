'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AuthScreen from '@/components/auth/AuthScreen';
import { useAuth } from '@/hooks/useAuth';
import { isPlanId, PLAN_ORDER, PLANS, type PlanId } from '@/lib/plans';
import PaymentStep from './PaymentStep';

function LogoMark() {
  return (
    <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-cyan-400/30 bg-gradient-to-br from-cyan-500/20 to-blue-600/10">
      <svg viewBox="0 0 24 24" className="h-4 w-4 text-cyan-300" fill="currentColor" aria-hidden="true">
        <path d="M8 5.5v13a1 1 0 0 0 1.5.87l11-6.5a1 1 0 0 0 0-1.74l-11-6.5A1 1 0 0 0 8 5.5Z" />
      </svg>
    </span>
  );
}

export default function CheckoutFlow({
  initialPlan,
  canceled = false,
}: {
  initialPlan?: string;
  canceled?: boolean;
}) {
  const router = useRouter();
  const { status, user, mode: authMode } = useAuth();
  // Pre-select the plan from ?plan= when valid; otherwise default to the
  // popular Pro tier and let the user change it.
  const [selected, setSelected] = useState<PlanId>(isPlanId(initialPlan) ? initialPlan : 'pro');
  const [annual, setAnnual] = useState(true);
  const [step, setStep] = useState<'plan' | 'payment'>('plan');
  const [authOpen, setAuthOpen] = useState(false);
  // Client-safe build flag: the Paddle pay button only appears when the
  // client token is configured (the API key stays server-side).
  const paddleEnabled = !!process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN;

  const signedIn = status === 'signed-in';
  // Firebase unconfigured → the app is guests-only, so there's nothing to
  // sign in to; skip the gate rather than dead-ending the checkout.
  const canSignIn = authMode === 'firebase';
  const paymentReady = signedIn || !canSignIn;

  const plan = PLANS[selected];
  const { price, note } = plan.priceFor(annual);

  return (
    <main className="relative min-h-screen overflow-x-clip bg-night-950 text-[#e8eaef]">
      {/* Ambient background: dot grid + cyan radials (matches the landing page) */}
      <div className="pointer-events-none fixed inset-0" aria-hidden>
        <div className="bg-dots absolute inset-0 opacity-60" />
        <div className="absolute inset-0 bg-[radial-gradient(800px_500px_at_75%_-10%,rgba(6,182,212,0.12),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(700px_440px_at_10%_110%,rgba(59,130,246,0.1),transparent_60%)]" />
      </div>

      {/* Minimal glass header */}
      <header className="sticky top-0 z-50 border-b border-white/5 bg-night-950/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between gap-4 px-5 lg:px-8">
          <Link href="/" className="flex items-center gap-2.5">
            <LogoMark />
            <span className="text-base font-extrabold tracking-tight text-white">
              Audio<span className="text-cyan-400">Repeat</span>
            </span>
          </Link>
          <div className="flex items-center gap-4">
            {signedIn && user?.photoURL && (
              <Image
                src={user.photoURL}
                alt=""
                width={28}
                height={28}
                className="h-7 w-7 rounded-full ring-1 ring-white/20"
              />
            )}
            <Link
              href="/dashboard"
              className="rounded-full bg-white px-4 py-1.5 text-xs font-semibold text-black transition hover:bg-slate-100 active:scale-95"
            >
              Practice
            </Link>
          </div>
        </div>
      </header>

      <div className="relative z-10 mx-auto w-full max-w-5xl px-5 py-12 lg:px-8">
        {canceled && (
          <div className="mx-auto mb-6 max-w-lg rounded-2xl border border-neon-amber/30 bg-neon-amber/10 px-4 py-3 text-center text-sm text-neon-amber">
            Your checkout was canceled — nothing was charged.
          </div>
        )}

        {step === 'plan' ? (
          <>
          <div className="text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-400">
              Checkout
            </p>
            <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-white md:text-4xl">
              Choose your plan
            </h1>
            <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-slate-400">
              Pick a tier to see the summary — payments launch soon, so nothing
              charges today.
            </p>

            {/* monthly / annual toggle (only affects Pro pricing) */}
            <div className="mt-8 inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] p-1">
              <button
                type="button"
                onClick={() => setAnnual(false)}
                className={`rounded-full px-5 py-2 text-[13px] font-semibold transition-all ${
                  !annual ? 'bg-white text-black shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => setAnnual(true)}
                className={`rounded-full px-5 py-2 text-[13px] font-semibold transition-all ${
                  annual ? 'bg-white text-black shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                Annual <span className="ml-1 text-[10px] font-bold text-emerald-400">−20%</span>
              </button>
            </div>
          </div>

          {/* Selectable plan cards — same visual language as the landing pricing */}
          <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-3">
            {PLAN_ORDER.map((id) => {
              const p = PLANS[id];
              const { price: pPrice, note: pNote } = p.priceFor(annual);
              const active = selected === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setSelected(id)}
                  aria-pressed={active}
                  className={`glass-neural relative flex flex-col rounded-[2rem] p-8 text-left transition ${
                    active
                      ? 'border-cyan-400/60 shadow-[0_0_50px_rgba(6,182,212,0.2)]'
                      : 'hover:border-white/25 hover:-translate-y-0.5'
                  }`}
                >
                  {p.popular && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-[#06b6d4] to-[#3b82f6] px-4 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-white shadow-[0_0_20px_rgba(6,182,212,0.5)]">
                      Most Popular
                    </span>
                  )}
                  <span className="flex items-center justify-between">
                    <span className="text-lg font-bold text-white">{p.name}</span>
                    <span
                      className={`flex h-6 w-6 items-center justify-center rounded-full border transition ${
                        active
                          ? 'border-cyan-400 bg-cyan-500/20 text-cyan-200'
                          : 'border-white/20 text-transparent'
                      }`}
                    >
                      <svg
                        viewBox="0 0 24 24"
                        className="h-3.5 w-3.5"
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
                  </span>
                  <p className="mt-1 text-[13px] text-slate-400">{p.tagline}</p>
                  <span className="mt-6 flex items-end gap-2">
                    <span className="text-5xl font-extrabold tracking-tight text-white">
                      ${pPrice}
                    </span>
                    <span className="pb-1.5 text-xs text-slate-500">{pNote}</span>
                  </span>
                  <span className="mt-7 space-y-3">
                    {p.features(0).map((f) => (
                      <span key={f} className="flex items-start gap-2.5 text-sm text-slate-300">
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
                      </span>
                    ))}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-10 flex flex-col items-center gap-3">
            <button
              type="button"
              onClick={() => setStep('payment')}
              className="btn-neural inline-flex h-12 items-center gap-2 rounded-full px-8 text-sm font-semibold text-white"
            >
              Continue with {plan.name} — ${price}
              <span className="text-xs font-medium opacity-80">{note}</span>
            </button>
            <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
              {paddleEnabled
                ? 'Secure payments handled by Paddle'
                : 'No charge today · payments coming soon'}
            </p>
          </div>
          </>
        ) : (
          <div>
            <button
              type="button"
              onClick={() => setStep('plan')}
              className="mb-6 inline-flex items-center gap-1.5 text-sm text-slate-400 transition hover:text-white"
            >
              ← Back to plans
            </button>

            {paymentReady ? (
              <PaymentStep
                plan={plan}
                billing={annual ? 'annual' : 'monthly'}
                signedIn={signedIn}
                user={user}
                paddleEnabled={paddleEnabled}
                onBack={() => setStep('plan')}
                onContinueFree={() => router.push('/dashboard')}
              />
            ) : (
              <div className="glass mx-auto w-full max-w-lg animate-fade-up rounded-3xl p-8 text-center">
                <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#141433] to-night-950 shadow-[0_0_30px_rgba(34,228,255,0.25)]">
                  <svg
                    viewBox="0 0 24 24"
                    className="h-7 w-7 text-neon-cyan drop-shadow-[0_0_6px_rgba(34,228,255,0.9)]"
                    fill="currentColor"
                    aria-hidden
                  >
                    <path d="M8 5.5v13a1 1 0 0 0 1.5.87l11-6.5a1 1 0 0 0 0-1.74l-11-6.5A1 1 0 0 0 8 5.5Z" />
                  </svg>
                </span>
                <h2 className="mt-5 text-xl font-bold tracking-tight text-white">
                  Sign in to continue checkout
                </h2>
                <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-slate-400">
                  You&apos;ve selected the <span className="font-semibold text-white">{plan.name}</span>{' '}
                  plan (${price}
                  {note}). We need an account to attach it to once payments launch — or keep
                  using everything free right now.
                </p>
                <div className="mt-6 flex flex-col gap-2.5">
                  <button
                    type="button"
                    onClick={() => setAuthOpen(true)}
                    className="btn-primary flex h-11 w-full items-center justify-center rounded-xl text-sm font-semibold text-white"
                  >
                    Sign in / Create account
                  </button>
                  <button
                    type="button"
                    onClick={() => router.push('/dashboard')}
                    className="btn-clean flex h-11 w-full items-center justify-center rounded-xl text-sm font-medium text-slate-300"
                  >
                    Continue with free access
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Reused auth overlay — Cancel just closes it, staying on the gate. */}
      {authOpen && (
        <AuthScreen
          mode="overlay"
          onClose={() => setAuthOpen(false)}
        />
      )}
    </main>
  );
}
