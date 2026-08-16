'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import AuthScreen from './AuthScreen';
import DowngradeModal from '@/components/checkout/DowngradeModal';
import { useAdminStatus } from '@/hooks/useAdminStatus';
import { useAuth } from '@/hooks/useAuth';
import { statsStorageKey, usernameStorageKey } from '@/lib/auth/scopes';
import { clearAccountPrefs } from '@/lib/accountPrefs';
import { clearOnboardingState } from '@/lib/onboarding';
import { isProPlan, PLAN_BADGE, planDetail } from '@/lib/plans';
import { getSettingsSnapshot, subscribeSettings } from '@/lib/settingsStore';

function initialsOf(name: string): string {
  const parts = name.trim().split(/[\s_-]+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function avatarHue(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i += 1) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return h % 360;
}

interface Props {
  onLeaderboard: () => void;
  onSubtitles: () => void;
  onBrowse: () => void;
}

const itemClass =
  'flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-slate-300 transition hover:bg-white/8 hover:text-white';

/**
 * Unified profile dropdown — the single header entry point. For guests it
 * opens with a "Sign in" item; for signed-in users it shows the avatar +
 * account identity. The same menu hosts the secondary tools (leaderboard,
 * stats, subtitles, browse library) so the top bar stays minimal: one button
 * for everything that isn't a primary action.
 */
export default function ProfileDropdown({ onLeaderboard, onSubtitles, onBrowse }: Props) {
  const { status, user, logout, deleteAccount } = useAuth();
  // Server-verified admin gate — admin links render only for allowlisted
  // admins and never flash before verification (fail-closed). This is a UX
  // convenience; the admin pages/APIs enforce access server-side regardless.
  const admin = useAdminStatus();
  // Reactive subscription to the shared settings store (the purchased plan
  // lives there, persisted by the checkout success flow). The store hydrates
  // once from IndexedDB; until then it reports the basic default, so the badge
  // settles within a frame or two of first paint.
  const settings = useSyncExternalStore(subscribeSettings, getSettingsSnapshot, getSettingsSnapshot);
  const pro = isProPlan(settings.plan);
  const [open, setOpen] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [showDowngrade, setShowDowngrade] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [menuError, setMenuError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (status === 'loading') return null;

  const close = () => setOpen(false);
  const signedIn = status === 'signed-in' && !!user;
  const hue = signedIn ? avatarHue(user!.username) : 0;

  const handleDelete = async () => {
    setMenuError(null);
    try {
      window.localStorage.removeItem(statsStorageKey(user!.id));
      window.localStorage.removeItem(usernameStorageKey(user!.id));
      // Per-uid entitlement + onboarding state (free language, hidden langs,
      // pending/completed onboarding) — never left behind for a future
      // account on this device.
      clearAccountPrefs(user!.id);
      clearOnboardingState(user!.id);
      const prefix = `audiorepeat-challenge-best-v1:${user!.id}:`;
      for (let i = window.localStorage.length - 1; i >= 0; i -= 1) {
        const key = window.localStorage.key(i);
        if (key && key.startsWith(prefix)) window.localStorage.removeItem(key);
      }
    } catch {
      /* ignore */
    }
    const res = await deleteAccount();
    if (!res.ok) {
      setMenuError(res.error);
      setConfirmDelete(false);
      return;
    }
    setOpen(false);
    setConfirmDelete(false);
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        title={signedIn ? `Signed in as ${user!.username}` : 'Account & tools'}
        className="btn-clean flex h-9 items-center gap-2 rounded-lg px-2 pr-2.5 text-[13px] font-medium text-slate-300"
      >
        {signedIn ? (
          <span className="shrink-0 rounded-full bg-gradient-to-br from-neon-violet to-neon-cyan p-px">
            {user!.photoURL ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user!.photoURL}
                alt=""
                referrerPolicy="no-referrer"
                className="h-6 w-6 rounded-full object-cover"
              />
            ) : (
              <span
                className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold text-white"
                style={{
                  background: `linear-gradient(135deg, hsl(${hue} 85% 60%), hsl(${(hue + 60) % 360} 85% 50%))`,
                }}
              >
                {initialsOf(user!.username)}
              </span>
            )}
          </span>
        ) : (
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-slate-400">
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="8" r="4" />
              <path d="M4 21c0-4 3.6-6 8-6s8 2 8 6" />
            </svg>
          </span>
        )}
        {signedIn && <span className="hidden max-w-[110px] truncate sm:block">{user!.username}</span>}
        <svg
          viewBox="0 0 24 24"
          className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Account & tools"
          className="glass animate-fade-up absolute right-0 top-full z-[100] mt-2 w-60 rounded-2xl p-2 shadow-[0_20px_60px_rgba(3,2,12,0.7)]"
        >
          {signedIn && (
            <>
              <div className="px-3 py-2">
                <p className="truncate text-sm font-semibold text-white">@{user!.username}</p>
                <p className="truncate text-[11px] text-slate-500">{user!.email ?? 'Firebase account'}</p>
                <p className="mt-1.5 flex items-center gap-1.5">
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                      pro
                        ? 'border-neon-amber/40 bg-neon-amber/15 text-neon-amber'
                        : 'border-white/10 text-slate-400'
                    }`}
                  >
                    {pro ? '★ ' : ''}
                    {PLAN_BADGE[settings.plan].short}
                  </span>
                  <span className="truncate text-[10px] text-slate-500">
                    {planDetail(settings.plan, settings.planBilling, settings.planSource)}
                  </span>
                </p>
              </div>
              <div className="my-1 h-px bg-white/10" />
            </>
          )}

          {pro ? (
            <>
              <Link role="menuitem" href="/checkout" className={itemClass} onClick={close}>
                <span aria-hidden>⭐</span> Manage plan
                <span className="ml-auto rounded-full border border-neon-amber/40 bg-neon-amber/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-neon-amber">
                  {PLAN_BADGE[settings.plan].short}
                </span>
              </Link>
              <button
                role="menuitem"
                className={itemClass}
                onClick={() => {
                  close();
                  setShowDowngrade(true);
                }}
              >
                <span aria-hidden>⬇️</span> Switch to Free plan
              </button>
            </>
          ) : (
            <Link role="menuitem" href="/checkout?plan=pro" className={itemClass} onClick={close}>
              <span aria-hidden>⭐</span> Upgrade to Pro
            </Link>
          )}

          <div className="my-1 h-px bg-white/10" />

          {/* Tools — grouped under the profile entry point */}
          <button
            role="menuitem"
            className={itemClass}
            onClick={() => {
              close();
              onLeaderboard();
            }}
          >
            <span aria-hidden>🏆</span> Leaderboard
          </button>
          <Link role="menuitem" href="/stats" className={itemClass} onClick={close}>
            <span aria-hidden>📊</span> Stats
          </Link>
          <button
            role="menuitem"
            className={itemClass}
            onClick={() => {
              close();
              onSubtitles();
            }}
          >
            <span aria-hidden>🎬</span> Subtitles → set
          </button>
          <button
            role="menuitem"
            className={itemClass}
            onClick={() => {
              close();
              onBrowse();
            }}
          >
            <span aria-hidden>📚</span> Browse library
          </button>

          {admin === 'admin' && (
            <>
              <div className="my-1 h-px bg-white/10" />
              <div className="px-3 pb-1 pt-1.5 text-[9px] font-bold uppercase tracking-[0.18em] text-slate-500">
                Admin
              </div>
              <Link role="menuitem" href="/admin/entitlements" className={itemClass} onClick={close}>
                <span aria-hidden>🎁</span> Gift Pro
              </Link>
              <Link role="menuitem" href="/admin/diagnostics" className={itemClass} onClick={close}>
                <span aria-hidden>🩺</span> Language Diagnostics
              </Link>
              <Link role="menuitem" href="/admin/analytics" className={itemClass} onClick={close}>
                <span aria-hidden>📈</span> Onboarding Analytics
              </Link>
            </>
          )}

          <div className="my-1 h-px bg-white/10" />

          {!signedIn ? (
            <button
              role="menuitem"
              className={itemClass}
              onClick={() => {
                close();
                setShowAuth(true);
              }}
            >
              <span aria-hidden>🔐</span> Sign in / Create account
            </button>
          ) : (
            <>
              <button
                role="menuitem"
                className={itemClass}
                onClick={() => {
                  setOpen(false);
                  logout();
                }}
              >
                <span aria-hidden>🚪</span> Sign out
              </button>
              {confirmDelete ? (
                <div className="mt-1 rounded-xl border border-neon-magenta/30 bg-neon-magenta/10 p-2">
                  <p className="px-1 pb-2 text-[11px] leading-snug text-neon-magenta">
                    Delete your Firebase account and its stats? This can&apos;t be undone.
                  </p>
                  {menuError && (
                    <p className="px-1 pb-2 text-[11px] leading-snug text-neon-magenta">{menuError}</p>
                  )}
                  <div className="flex gap-1.5">
                    <button
                      role="menuitem"
                      onClick={() => void handleDelete()}
                      className="flex-1 rounded-lg bg-neon-magenta px-2 py-1.5 text-xs font-semibold text-white transition hover:brightness-110 active:scale-95"
                    >
                      Delete
                    </button>
                    <button
                      role="menuitem"
                      onClick={() => {
                        setConfirmDelete(false);
                        setMenuError(null);
                      }}
                      className="flex-1 rounded-lg border border-white/10 px-2 py-1.5 text-xs text-slate-300 transition hover:text-white active:scale-95"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  role="menuitem"
                  onClick={() => {
                    setConfirmDelete(true);
                    setMenuError(null);
                  }}
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-neon-magenta transition hover:bg-neon-magenta/10"
                >
                  <span aria-hidden>🗑</span> Delete account
                </button>
              )}
            </>
          )}
        </div>
      )}

      {showAuth && <AuthScreen mode="overlay" onClose={() => setShowAuth(false)} />}
      {showDowngrade && <DowngradeModal onClose={() => setShowDowngrade(false)} />}
    </div>
  );
}
