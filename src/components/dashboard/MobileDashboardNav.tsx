'use client';

import { useSyncExternalStore, type ReactNode } from 'react';
import SettingsButton from '@/components/settings/SettingsButton';
import { useT } from '@/lib/i18n';

interface Props {
  /** Starts the most recently used set (or the featured set for a new learner). */
  onResume: () => void;
  resumeAvailable: boolean;
  activeTab: 'home' | 'review' | 'library';
  onTabChange: (tab: 'home' | 'review' | 'library') => void;
}

function getStandaloneSnapshot() {
  const ios = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia('(display-mode: standalone)').matches || ios.standalone === true;
}

function subscribeToStandaloneMode(onChange: () => void) {
  const media = window.matchMedia('(display-mode: standalone)');
  media.addEventListener('change', onChange);
  return () => media.removeEventListener('change', onChange);
}

function NavItem({
  label,
  onClick,
  active = false,
  children,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={`relative flex h-14 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-2xl px-1 text-[10px] font-semibold transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan active:scale-95 ${
        active ? 'bg-cyan-400/10 text-cyan-200' : 'text-slate-400 hover:bg-white/5 hover:text-white'
      }`}
    >
      {active && <span className="absolute top-1.5 h-1 w-1 rounded-full bg-cyan-300 shadow-[0_0_8px_rgba(103,232,249,0.9)]" aria-hidden />}
      {children}
      <span className="max-w-full truncate leading-none">{label}</span>
    </button>
  );
}

function BrowserNavItem({
  label,
  onClick,
  active = false,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={`flex h-9 min-w-0 items-center justify-center rounded-xl px-2 text-[11px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan active:scale-95 ${
        active ? 'bg-cyan-400/15 text-cyan-100' : 'text-slate-300 hover:bg-white/5 hover:text-white'
      }`}
    >
      <span className="truncate">{label}</span>
    </button>
  );
}

/** Uses a browser header on mobile web and thumb navigation in the installed app. */
export default function MobileDashboardNav({ onResume, resumeAvailable, activeTab, onTabChange }: Props) {
  const t = useT();
  const standalone = useSyncExternalStore(subscribeToStandaloneMode, getStandaloneSnapshot, () => false);
  const resumeLabel = resumeAvailable ? t('dashboard.mobileNav.resume') : t('dashboard.checklist.sets.action');

  // Browser visits use a visible website-style header; installed PWA keeps its app shell.
  if (!standalone) {
    return (
      <div className="h-14 md:hidden">
        <header className="fixed inset-x-0 top-0 z-[60] border-b border-white/10 bg-[#10131c]/95 shadow-[0_8px_28px_rgba(0,0,0,0.3)] backdrop-blur-xl">
          <nav aria-label={t('dashboard.mobileNav.aria')} className="mx-auto flex h-14 max-w-7xl items-center gap-1 px-3">
            <button
              type="button"
              onClick={() => onTabChange('home')}
              aria-label="AudioRepeat"
              className="mr-1 flex h-9 shrink-0 items-center rounded-xl px-2 text-sm font-bold tracking-tight text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan"
            >
              <span className="text-cyan-300">A</span><span className="hidden min-[360px]:inline">udioRepeat</span>
            </button>
            <div className="grid min-w-0 flex-1 grid-cols-3 gap-1">
              <BrowserNavItem label={t('dashboard.mobileNav.home')} active={activeTab === 'home'} onClick={() => onTabChange('home')} />
              <BrowserNavItem label={t('dashboard.mobileNav.review')} active={activeTab === 'review'} onClick={() => onTabChange('review')} />
              <BrowserNavItem label={t('dashboard.mobileNav.library')} active={activeTab === 'library'} onClick={() => onTabChange('library')} />
            </div>
            <SettingsButton className="ml-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-300 transition hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan" />
          </nav>
        </header>
      </div>
    );
  }

  return (
    <nav
      aria-label={t('dashboard.mobileNav.aria')}
      className="fixed inset-x-0 bottom-0 z-[60] px-3 pb-[env(safe-area-inset-bottom)] pt-3 md:hidden"
    >
      <div className="mx-auto grid h-[4.5rem] w-full max-w-md grid-cols-[minmax(0,1fr)_minmax(0,1fr)_4.5rem_minmax(0,1fr)_minmax(0,1fr)] items-center gap-1 rounded-[1.6rem] border border-white/10 bg-[#11131c]/95 px-1.5 shadow-[0_12px_36px_rgba(0,0,0,0.42),inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-2xl">
        <NavItem label={t('dashboard.mobileNav.home')} active={activeTab === 'home'} onClick={() => onTabChange('home')}>
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden>
            <path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1V10Z" />
          </svg>
        </NavItem>

        <NavItem label={t('dashboard.mobileNav.review')} active={activeTab === 'review'} onClick={() => onTabChange('review')}>
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden>
            <path d="M12 8v4l2.5 2.5" />
            <circle cx="12" cy="12" r="8.5" />
          </svg>
        </NavItem>

        <button
          type="button"
          onClick={onResume}
          aria-label={resumeLabel}
          className="btn-primary -mt-7 flex h-[4.5rem] w-[4.5rem] min-w-0 flex-col items-center justify-center rounded-full border-4 border-[#11131c] text-white shadow-[0_10px_26px_rgba(14,165,233,0.38)] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-[#11131c] active:scale-95"
        >
          <svg viewBox="0 0 24 24" className="h-6 w-6 translate-x-0.5" fill="currentColor" aria-hidden>
            <path d="M8 5.5v13a1 1 0 0 0 1.5.87l10-6.5a1 1 0 0 0 0-1.74l-10-6.5A1 1 0 0 0 8 5.5Z" />
          </svg>
        </button>

        <NavItem label={t('dashboard.mobileNav.library')} active={activeTab === 'library'} onClick={() => onTabChange('library')}>
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden>
            <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5v-16Z" />
            <path d="M4 19h16v2H6.5A2.5 2.5 0 0 1 4 18.5" />
          </svg>
        </NavItem>

        <div className="flex h-14 min-w-0 flex-1 flex-col items-center justify-center gap-1 text-[10px] font-semibold text-slate-400">
          <SettingsButton className="flex h-8 w-8 items-center justify-center rounded-2xl text-slate-400 transition hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan" />
          <span className="max-w-full truncate leading-none">{t('dashboard.mobileNav.settings')}</span>
        </div>
      </div>
    </nav>
  );
}
