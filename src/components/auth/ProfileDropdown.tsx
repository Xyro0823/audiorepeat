'use client';

import Link from 'next/link';
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { ArrowDown, BadgeHelp, BarChart3, Bug, Clapperboard, Download, FilePenLine, FileText, Gift, Keyboard, LibraryBig, LogIn, LogOut, Megaphone, Palette, ShieldAlert, ShieldCheck, Sparkles, Stethoscope, Trophy, Trash2, UserRound, Settings as SettingsIcon } from 'lucide-react';
import AuthScreen from './AuthScreen';
import DowngradeModal from '@/components/checkout/DowngradeModal';
import { useAdminStatus } from '@/hooks/useAdminStatus';
import { useAuth } from '@/hooks/useAuth';
import { statsStorageKey, usernameStorageKey } from '@/lib/auth/scopes';
import { clearAccountPrefs } from '@/lib/accountPrefs';
import { deleteSetDatabaseForOwner } from '@/lib/db/indexedDb';
import { firstSessionGuideKey } from '@/lib/firstSessionGuide';
import { clearOnboardingState } from '@/lib/onboarding';
import { isProPlan, PLAN_BADGE, planDetail } from '@/lib/plans';
import { useT } from '@/lib/i18n';
import { getSettingsSnapshot, subscribeSettings } from '@/lib/settingsStore';
import { saveDashboardScrollPosition } from '@/lib/libraryScrollPosition';

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
  className?: string;
  sidebar?: boolean;
}

const itemClass =
  'flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-slate-300 transition hover:bg-white/[0.08] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan';

/**
 * Unified profile dropdown — the single header entry point. For guests it
 * opens with a "Sign in" item; for signed-in users it shows the avatar +
 * account identity. The same menu hosts the secondary tools (leaderboard,
 * stats, subtitles, browse library) so the top bar stays minimal: one button
 * for everything that isn't a primary action.
 */
export default function ProfileDropdown({ onLeaderboard, onSubtitles, onBrowse, className, sidebar = false }: Props) {
  const { status, user, logout, deleteAccount } = useAuth();
  const t = useT();
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
  const menuRef = useRef<HTMLDivElement>(null);
  // Flip/clamp state — keeps the open menu inside the viewport: opens upward
  // when there's no room below (e.g. the dashboard hero pushes the header to
  // the fold) and clamps horizontally so it never hangs off an edge.
  const [pos, setPos] = useState<{ up: boolean; left: number; maxH: number } | null>(null);

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

  // Runs before paint, so the panel never flashes in the wrong spot. Height is
  // capped to the space available in the open direction so short screens keep
  // the whole menu reachable via its own scrollbar.
  useLayoutEffect(() => {
    if (!open) return;
    const menu = menuRef.current;
    const btn = rootRef.current?.querySelector<HTMLElement>('button[aria-haspopup]');
    if (!menu || !btn) return;
    const b = btn.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const spaceBelow = vh - b.bottom;
    const spaceAbove = b.top;
    const up = spaceBelow < 320 && spaceAbove >= 200;
    const maxH = Math.max(180, Math.floor((up ? spaceAbove : spaceBelow) - 8));
    // Keep the panel inside the viewport horizontally. Preserve the current
    // right-aligned feel when it fits; clamp only when it would hang off.
    // `left` is applied in the root div's coordinate space (it is the
    // containing block), so offset by its viewport position.
    const rootRect = rootRef.current?.getBoundingClientRect();
    if (!rootRect) return;
    const w = menu.offsetWidth;
    const rightAlignedLeft = Math.round(b.right - w);
    const viewportLeft =
      rightAlignedLeft >= 8 && rightAlignedLeft <= vw - 8
        ? rightAlignedLeft
        : Math.min(Math.max(Math.round(b.left), 8), Math.max(8, vw - w - 8));
    setPos({ up, left: viewportLeft - rootRect.left, maxH });
  }, [open]);

  if (status === 'loading') return null;

  const close = () => setOpen(false);
  // Account/help pages live outside the dashboard route, so Next's normal
  // navigation starts their return visit at the top. Keep one return position
  // only when this menu is opened from the dashboard; SetLibrary consumes it
  // after its content is ready, just like the player return flow.
  const closeAndRememberDashboard = () => {
    if (typeof window !== 'undefined' && window.location.pathname === '/dashboard') {
      saveDashboardScrollPosition(window.scrollY);
    }
    close();
  };
  const signedIn = status === 'signed-in' && !!user;
  const hue = signedIn ? avatarHue(user!.username) : 0;

  const handleDelete = async () => {
    setMenuError(null);
    const deletedUid = user?.id;
    if (!deletedUid) {
      setMenuError(t('auth.error.reSignInToDelete'));
      setConfirmDelete(false);
      return;
    }
    // Attempt server-side deletion FIRST. Only clear local data if the
    // account was actually removed — otherwise a requires-recent-login
    // failure would destroy local data while leaving the account active.
    const res = await deleteAccount();
    if (!res.ok) {
      setMenuError(res.error);
      setConfirmDelete(false);
      return;
    }
    // Account deleted — now safe to clean up its owner-scoped IndexedDB.
    try {
      await deleteSetDatabaseForOwner(deletedUid);
    } catch {
      /* ignore — account is already removed; browser storage may be blocked */
    }
    // Remove the remaining owner-scoped local state.
    try {
      window.localStorage.removeItem(statsStorageKey(deletedUid));
      window.localStorage.removeItem(usernameStorageKey(deletedUid));
      window.localStorage.removeItem(firstSessionGuideKey(deletedUid));
      clearAccountPrefs(deletedUid);
      clearOnboardingState(deletedUid);
      const prefix = `audiorepeat-challenge-best-v1:${deletedUid}:`;
      for (let i = window.localStorage.length - 1; i >= 0; i -= 1) {
        const key = window.localStorage.key(i);
        if (key && key.startsWith(prefix)) window.localStorage.removeItem(key);
      }
    } catch {
      /* ignore — account already removed */
    }
    setOpen(false);
    setConfirmDelete(false);
  };

  return (
    <div ref={rootRef} className={`relative ${className ?? ''}`}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        title={
          signedIn ? t('auth.signedInAs', { name: user!.username }) : t('auth.accountAndTools')
        }
        className={`btn-toolbar-ghost flex h-11 items-center gap-2 rounded-xl px-2 pr-2.5 text-[13px] font-medium text-slate-300 ${sidebar ? 'w-full justify-between px-3' : ''}`}
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
        {signedIn && <span className={`${sidebar ? 'block max-w-[190px]' : 'hidden max-w-[110px] sm:block'} truncate`}>{user!.username}</span>}
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
          ref={menuRef}
          role="menu"
          aria-label={t('auth.accountAndTools')}
          className={`dropdown-panel animate-fade-up absolute right-0 z-[100] w-64 ${sidebar ? 'overflow-visible' : 'overflow-y-auto overscroll-contain'} rounded-2xl border border-white/10 bg-[#11141d]/95 p-2 shadow-[0_20px_55px_rgba(0,0,0,0.45)] backdrop-blur-xl ${
            pos?.up ? 'bottom-full mb-2' : 'top-full mt-2'
          }`}
          style={pos ? { maxHeight: pos.maxH, left: pos.left, right: 'auto' } : undefined}
        >
          {signedIn && (
            <>
              <div className="px-3 py-2">
                <p className="truncate text-sm font-semibold text-white">@{user!.username}</p>
                <p className="truncate text-[11px] text-slate-500">
                  {user!.email ?? t('auth.firebaseAccount')}
                </p>
                <p className="mt-1.5 flex items-center gap-1.5">
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                      pro
                        ? 'border-neon-amber/40 bg-neon-amber/15 text-neon-amber'
                        : 'border-white/10 text-slate-400'
                    }`}
                  >
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

          {sidebar && (
            <>
              <Link role="menuitem" href={pro ? '/checkout' : '/checkout?plan=pro'} className={itemClass} onClick={closeAndRememberDashboard}>
                <Sparkles className="h-4 w-4" strokeWidth={1.9} aria-hidden /> {pro ? t('auth.managePlan') : t('auth.upgradeToPro')}
              </Link>
              <Link role="menuitem" href="/account/personalization" className={itemClass} onClick={closeAndRememberDashboard}>
                <Palette className="h-4 w-4" strokeWidth={1.9} aria-hidden /> Personalization
              </Link>
              <Link role="menuitem" href="/account" className={itemClass} onClick={closeAndRememberDashboard}>
                <UserRound className="h-4 w-4" strokeWidth={1.9} aria-hidden /> Профайл
              </Link>
              <Link role="menuitem" href="/settings" className={itemClass} onClick={closeAndRememberDashboard}>
                <SettingsIcon className="h-4 w-4" strokeWidth={1.9} aria-hidden /> {t('dashboard.mobileNav.settings')}
              </Link>
              <div className="my-1 h-px bg-white/10" />
              <div className="group relative">
                <Link role="menuitem" href="/help" className={`${itemClass} group-hover:bg-white/8 group-focus-within:bg-white/8`} onClick={closeAndRememberDashboard}>
                  <BadgeHelp className="h-4 w-4" strokeWidth={1.9} aria-hidden /> Help
                  <span className="ml-auto text-base leading-none text-slate-400" aria-hidden>›</span>
                </Link>
                <div className="invisible pointer-events-none absolute bottom-0 left-full z-[110] w-64 rounded-2xl border border-white/10 bg-[#11141d]/95 p-2 opacity-0 shadow-[0_20px_55px_rgba(0,0,0,0.45)] backdrop-blur-xl transition duration-150 group-hover:visible group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:visible group-focus-within:pointer-events-auto group-focus-within:opacity-100">
                  <p className="px-3 pb-1 pt-1 text-[10px] font-bold uppercase tracking-[0.17em] text-slate-500">Help &amp; support</p>
                  <Link role="menuitem" href="/help" className={itemClass} onClick={closeAndRememberDashboard}><BadgeHelp className="h-4 w-4" strokeWidth={1.9} aria-hidden /> Help center</Link>
                  <Link role="menuitem" href="/help/release-notes" className={itemClass} onClick={closeAndRememberDashboard}><Megaphone className="h-4 w-4" strokeWidth={1.9} aria-hidden /> Release notes</Link>
                  <Link role="menuitem" href="/help/download-apps" className={itemClass} onClick={closeAndRememberDashboard}><Download className="h-4 w-4" strokeWidth={1.9} aria-hidden /> Download apps</Link>
                  <Link role="menuitem" href="/help/shortcuts" className={itemClass} onClick={closeAndRememberDashboard}><Keyboard className="h-4 w-4" strokeWidth={1.9} aria-hidden /> Keyboard shortcuts</Link>
                  <div className="my-1 h-px bg-white/10" />
                  <Link role="menuitem" href="/terms" className={itemClass} onClick={closeAndRememberDashboard}><FileText className="h-4 w-4" strokeWidth={1.9} aria-hidden /> Terms of Service</Link>
                  <Link role="menuitem" href="/privacy" className={itemClass} onClick={closeAndRememberDashboard}><ShieldCheck className="h-4 w-4" strokeWidth={1.9} aria-hidden /> Privacy Policy</Link>
                  <Link role="menuitem" href="/help/report-bug" className={itemClass} onClick={closeAndRememberDashboard}><Bug className="h-4 w-4" strokeWidth={1.9} aria-hidden /> Report a bug</Link>
                </div>
              </div>
            </>
          )}

          {!sidebar && (pro ? (
            <>
              <Link role="menuitem" href="/checkout" className={itemClass} onClick={close}>
                <Sparkles className="h-4 w-4" strokeWidth={1.9} aria-hidden /> {t('auth.managePlan')}
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
                <ArrowDown className="h-4 w-4" strokeWidth={1.9} aria-hidden /> {t('auth.switchToFreePlan')}
              </button>
            </>
          ) : (
            <Link role="menuitem" href="/checkout?plan=pro" className={itemClass} onClick={close}>
              <Sparkles className="h-4 w-4" strokeWidth={1.9} aria-hidden /> {t('auth.upgradeToPro')}
            </Link>
          ))}

          {!sidebar && <div className="my-1 h-px bg-white/10" />}

          {/* Tools — grouped under the profile entry point */}
          {!sidebar && <><button
            role="menuitem"
            className={itemClass}
            onClick={() => {
              close();
              onLeaderboard();
            }}
          >
            <Trophy className="h-4 w-4" strokeWidth={1.9} aria-hidden /> {t('auth.leaderboard')}
          </button>
          <Link role="menuitem" href="/stats" className={itemClass} onClick={close}>
            <BarChart3 className="h-4 w-4" strokeWidth={1.9} aria-hidden /> {t('auth.stats')}
            {!pro && (
              <span className="ml-auto rounded-full bg-neon-amber/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-neon-amber">
                Pro
              </span>
            )}
          </Link>
          <button
            role="menuitem"
            className={itemClass}
            onClick={() => {
              close();
              onSubtitles();
            }}
          >
            <Clapperboard className="h-4 w-4" strokeWidth={1.9} aria-hidden /> {t('auth.subtitlesToSet')}
          </button>
          <button
            role="menuitem"
            className={itemClass}
            onClick={() => {
              close();
              onBrowse();
            }}
          >
            <LibraryBig className="h-4 w-4" strokeWidth={1.9} aria-hidden /> {t('auth.browseLibrary')}
          </button></>}

          {!sidebar && admin === 'admin' && (
            <>
              <div className="my-1 h-px bg-white/10" />
              <div className="px-3 pb-1 pt-1.5 text-[9px] font-bold uppercase tracking-[0.18em] text-slate-500">
                {t('auth.adminSection')}
              </div>
              <Link role="menuitem" href="/admin/entitlements" className={itemClass} onClick={close}>
                <Gift className="h-4 w-4" strokeWidth={1.9} aria-hidden /> {t('auth.giftPro')}
              </Link>
              <Link role="menuitem" href="/admin/diagnostics" className={itemClass} onClick={close}>
                <Stethoscope className="h-4 w-4" strokeWidth={1.9} aria-hidden /> {t('auth.languageDiagnostics')}
              </Link>
              <Link role="menuitem" href="/admin/analytics" className={itemClass} onClick={close}>
                <BarChart3 className="h-4 w-4" strokeWidth={1.9} aria-hidden /> {t('auth.onboardingAnalytics')}
              </Link>
              <Link role="menuitem" href="/admin/errors" className={itemClass} onClick={close}>
                <ShieldAlert className="h-4 w-4" strokeWidth={1.9} aria-hidden /> {t('auth.errorDiagnostics')}
              </Link>
              <Link role="menuitem" href="/admin/translations" className={itemClass} onClick={close}>
                <FilePenLine className="h-4 w-4" strokeWidth={1.9} aria-hidden /> {t('auth.translationReports')}
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
              <LogIn className="h-4 w-4" strokeWidth={1.9} aria-hidden /> {t('auth.signInOrCreate')}
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
                <LogOut className="h-4 w-4" strokeWidth={1.9} aria-hidden /> {t('auth.signOut')}
              </button>
              {confirmDelete ? (
                <div className="mt-1 rounded-xl border border-neon-magenta/30 bg-neon-magenta/10 p-2">
                  <p className="px-1 pb-2 text-[11px] leading-snug text-neon-magenta">
                    {t('auth.deleteConfirm.body')}
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
                      {t('auth.deleteConfirm.delete')}
                    </button>
                    <button
                      role="menuitem"
                      onClick={() => {
                        setConfirmDelete(false);
                        setMenuError(null);
                      }}
                      className="flex-1 rounded-lg border border-white/10 px-2 py-1.5 text-xs text-slate-300 transition hover:text-white active:scale-95"
                    >
                      {t('common.cancel')}
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
                  <Trash2 className="h-4 w-4" strokeWidth={1.9} aria-hidden /> {t('auth.deleteAccount')}
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
