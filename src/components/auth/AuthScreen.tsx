'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '@/hooks/useAuth';

type Mode = 'gate' | 'overlay';

interface Props {
  /**
   * 'gate' — replaces the whole app (shown by AuthGate after sign-out).
   * 'overlay' — a modal over the app (opened from the "Sign in" chip button).
   */
  mode?: Mode;
  onClose?: () => void;
}

const inputClass =
  'w-full rounded-xl border border-white/10 bg-night-800/80 px-4 py-2.5 text-white placeholder:text-slate-600 outline-none transition focus:border-neon-cyan/60';

function GoogleGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.5 12.27c0-.85-.08-1.66-.22-2.45H12v4.64h6.45a5.52 5.52 0 0 1-2.39 3.62v3h3.87c2.26-2.09 3.57-5.17 3.57-8.81Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.93-2.91l-3.87-3c-1.07.72-2.44 1.14-4.06 1.14-3.12 0-5.77-2.11-6.71-4.95H1.29v3.1A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.29 14.28a7.2 7.2 0 0 1 0-4.56v-3.1H1.29a12 12 0 0 0 0 10.76l4-3.1Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.77c1.76 0 3.34.6 4.58 1.79l3.44-3.44A11.97 11.97 0 0 0 12 0 12 12 0 0 0 1.29 6.62l4 3.1C6.23 6.88 8.88 4.77 12 4.77Z"
      />
    </svg>
  );
}

function Logo({ size = 'md' }: { size?: 'md' | 'lg' }) {
  const box = size === 'lg' ? 'h-16 w-16 rounded-3xl' : 'h-11 w-11 rounded-2xl';
  const icon = size === 'lg' ? 'h-8 w-8' : 'h-6 w-6';
  return (
    <div
      className={`flex items-center justify-center bg-gradient-to-br from-[#141433] to-night-950 shadow-[0_0_30px_rgba(34,228,255,0.25)] ${box}`}
    >
      <svg
        viewBox="0 0 24 24"
        className={`${icon} text-neon-cyan drop-shadow-[0_0_6px_rgba(34,228,255,0.9)]`}
        fill="currentColor"
      >
        <path d="M8 5.5v13a1 1 0 0 0 1.5.87l11-6.5a1 1 0 0 0 0-1.74l-11-6.5A1 1 0 0 0 8 5.5Z" />
      </svg>
    </div>
  );
}

export default function AuthScreen({ mode = 'gate', onClose }: Props) {
  const { signup, login, signInWithGoogle, continueAsGuest, mode: authMode } = useAuth();
  const configured = authMode === 'firebase';

  const [tab, setTab] = useState<'signin' | 'signup'>('signin');
  const [identifier, setIdentifier] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (mode !== 'overlay') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mode, onClose]);

  const done = useCallback(() => {
    if (mode === 'overlay') onClose?.();
  }, [mode, onClose]);

  const submit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (busy || !configured) return;
      if (tab === 'signup' && password !== confirm) {
        setError('Passwords do not match.');
        return;
      }
      setBusy(true);
      setError(null);
      const res =
        tab === 'signup'
          ? await signup(identifier, password, displayName || undefined)
          : await login(identifier, password);
      setBusy(false);
      if (!res.ok) {
        setError(res.error);
      } else {
        done();
      }
    },
    [busy, configured, tab, password, confirm, identifier, displayName, signup, login, done],
  );

  const google = useCallback(async () => {
    if (busy || !configured) return;
    setBusy(true);
    setError(null);
    const res = await signInWithGoogle();
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
    } else {
      done();
    }
  }, [busy, configured, signInWithGoogle, done]);

  const switchTab = (next: 'signin' | 'signup') => {
    setTab(next);
    setError(null);
  };

  const screen = (
    // `m-auto` on the card keeps it centered when it fits and scrollable from
    // the top when it doesn't (small phones with the keyboard open) — plain
    // flex centering would clip the top of an overflowing card.
    <div
      className="fixed inset-0 z-[100] flex overflow-y-auto bg-night-950/95 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={configured ? (tab === 'signup' ? 'Create account' : 'Sign in') : 'Sign in'}
    >
      {/* Ambient glows */}
      <div className="pointer-events-none absolute -top-24 left-1/4 h-72 w-72 rounded-full bg-neon-cyan/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 right-1/4 h-72 w-72 rounded-full bg-neon-cyan/15 blur-3xl" />

      <div className="glass animate-fade-up m-auto w-full max-w-md rounded-3xl p-8 shadow-[0_0_60px_rgba(34,228,255,0.12)]">
        <div className="flex flex-col items-center text-center">
          <Logo size="lg" />
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-white">AudioRepeat</h1>
          <p className="mt-1 text-sm text-slate-400">
            {mode === 'gate'
              ? 'Sign in to keep your streaks and progress, or start fresh as a guest.'
              : 'Create an account to keep your own stats and streak.'}
          </p>
        </div>

        {!configured ? (
          <div className="mt-6 rounded-2xl border border-neon-amber/30 bg-neon-amber/10 p-4 text-left">
            <p className="text-sm font-semibold text-neon-amber">🔧 Firebase not configured</p>
            <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">
              Sign-in uses Firebase Authentication. To enable it: copy{' '}
              <code className="rounded bg-night-800 px-1 py-0.5 text-[10px] text-neon-cyan">.env.example</code>{' '}
              to{' '}
              <code className="rounded bg-night-800 px-1 py-0.5 text-[10px] text-neon-cyan">.env.local</code>
              , paste your Firebase web app config (Firebase console → Project settings → Your
              apps → SDK setup and configuration), then restart the dev server. Until then the
              app runs in guest mode — no accounts, no sign-in.
            </p>
          </div>
        ) : (
          <>
            <button
              onClick={() => void google()}
              disabled={busy}
              className="mt-6 flex w-full items-center justify-center gap-3 rounded-xl border border-white/15 bg-white/[0.03] py-3 text-sm font-semibold text-white transition hover:border-white/30 hover:bg-white/[0.06] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <GoogleGlyph />
              {busy ? 'Working…' : 'Sign in with Google'}
            </button>
            <div className="mt-4 flex items-center gap-3">
              <span className="h-px flex-1 bg-white/10" />
              <span className="text-[11px] uppercase tracking-wider text-slate-600">
                or use email
              </span>
              <span className="h-px flex-1 bg-white/10" />
            </div>

            {/* Sign in / Create account */}
            <div className="mt-4 flex gap-1.5 rounded-2xl border border-white/10 bg-night-900/60 p-1.5">
              {(
                [
                  { id: 'signin', label: 'Sign in' },
                  { id: 'signup', label: 'Create account' },
                ] as const
              ).map((t) => (
                <button
                  key={t.id}
                  onClick={() => switchTab(t.id)}
                  aria-pressed={tab === t.id}
                  className={`flex-1 rounded-xl px-3 py-2 text-sm font-semibold transition active:scale-95 ${
                    tab === t.id
                      ? 'bg-gradient-to-r from-neon-cyan/20 to-neon-violet/20 text-white ring-1 ring-neon-cyan/40'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <form onSubmit={submit} className="mt-5 space-y-3">
              {tab === 'signup' && (
                <div>
                  <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-slate-500">
                    Display name <span className="normal-case text-slate-600">(optional)</span>
                  </label>
                  <input
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    autoComplete="name"
                    placeholder="How your leaderboard shows you"
                    className={inputClass}
                  />
                </div>
              )}
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-slate-500">
                  Email
                </label>
                <input
                  type="email"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  autoComplete="email"
                  placeholder="you@example.com"
                  className={inputClass}
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-slate-500">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete={tab === 'signup' ? 'new-password' : 'current-password'}
                    placeholder={tab === 'signup' ? 'At least 6 characters' : 'Your password'}
                    className={`${inputClass} pr-12`}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass((s) => !s)}
                    aria-label={showPass ? 'Hide password' : 'Show password'}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-xs text-slate-500 transition hover:text-white"
                  >
                    {showPass ? '🙈' : '👁'}
                  </button>
                </div>
              </div>
              {tab === 'signup' && (
                <div>
                  <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-slate-500">
                    Confirm password
                  </label>
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    autoComplete="new-password"
                    placeholder="Repeat your password"
                    className={inputClass}
                    required
                  />
                </div>
              )}

              {error && (
                <div className="animate-fade-up rounded-xl border border-neon-magenta/40 bg-neon-magenta/10 px-4 py-2.5 text-sm text-neon-magenta">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-xl bg-gradient-to-r from-neon-cyan to-neon-violet py-3 text-sm font-bold text-night-950 shadow-[0_0_20px_rgba(34,228,255,0.35)] transition hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy ? (
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-night-950/30 border-t-night-950 align-middle" />
                ) : tab === 'signup' ? (
                  'Create account'
                ) : (
                  'Sign in'
                )}
              </button>
            </form>
          </>
        )}

        <div className="mt-5 flex items-center gap-3">
          <span className="h-px flex-1 bg-white/10" />
          <span className="text-[11px] uppercase tracking-wider text-slate-600">or</span>
          <span className="h-px flex-1 bg-white/10" />
        </div>

        {mode === 'gate' ? (
          <button
            onClick={continueAsGuest}
            className="mt-4 w-full rounded-xl border border-white/10 py-3 text-sm font-medium text-slate-300 transition hover:border-white/25 hover:text-white active:scale-[0.98]"
          >
            Continue as guest
          </button>
        ) : (
          <button
            onClick={onClose}
            className="mt-4 w-full rounded-xl border border-white/10 py-3 text-sm font-medium text-slate-300 transition hover:border-white/25 hover:text-white active:scale-[0.98]"
          >
            Cancel
          </button>
        )}

        <p className="mt-5 text-center text-[11px] leading-relaxed text-slate-600">
          🔒 Firebase accounts sync your identity online — your vocabulary sets, streaks and stats
          stay on this device. Sign-in needs an internet connection; listening works offline.
        </p>
      </div>
    </div>
  );

  // In overlay mode the host (ProfileChip) sits inside an animated header whose
  // retained transform would trap this fixed overlay — portal to body instead.
  if (mode === 'overlay') {
    return typeof document !== 'undefined' ? createPortal(screen, document.body) : null;
  }
  return screen;
}
