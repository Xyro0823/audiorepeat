'use client';

import type { ReactNode } from 'react';
import SettingsButton from '@/components/settings/SettingsButton';
import { useT } from '@/lib/i18n';

interface Props {
  /** Starts the most recently used set (or the featured set for a new learner). */
  onResume: () => void;
  resumeAvailable: boolean;
}

function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function NavItem({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-14 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[10px] font-semibold text-slate-400 transition hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan active:scale-95"
    >
      {children}
      <span className="max-w-full truncate leading-none">{label}</span>
    </button>
  );
}

/** Thumb-reachable navigation for the dashboard below tablet width. */
export default function MobileDashboardNav({ onResume, resumeAvailable }: Props) {
  const t = useT();
  const resumeLabel = resumeAvailable ? t('dashboard.mobileNav.resume') : t('dashboard.checklist.sets.action');

  return (
    <nav
      aria-label={t('dashboard.mobileNav.aria')}
      className="fixed inset-x-0 bottom-0 z-[60] border-t border-white/10 bg-night-950/90 px-2 pb-[env(safe-area-inset-bottom)] pt-1.5 backdrop-blur-xl md:hidden"
    >
      <div className="mx-auto flex w-full max-w-lg items-end">
        <NavItem label={t('dashboard.mobileNav.home')} onClick={() => scrollTo('dashboard-top')}>
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden>
            <path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1V10Z" />
          </svg>
        </NavItem>

        <NavItem label={t('dashboard.mobileNav.review')} onClick={() => scrollTo('review-today')}>
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden>
            <path d="M12 8v4l2.5 2.5" />
            <circle cx="12" cy="12" r="8.5" />
          </svg>
        </NavItem>

        <button
          type="button"
          onClick={onResume}
          aria-label={resumeLabel}
          className="btn-primary -mt-4 flex h-16 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-2xl px-1 text-[10px] font-bold text-white shadow-[0_0_24px_rgba(34,228,255,0.2)] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan active:scale-95"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5 translate-x-0.5" fill="currentColor" aria-hidden>
            <path d="M8 5.5v13a1 1 0 0 0 1.5.87l10-6.5a1 1 0 0 0 0-1.74l-10-6.5A1 1 0 0 0 8 5.5Z" />
          </svg>
          <span className="max-w-full truncate leading-none">{resumeLabel}</span>
        </button>

        <NavItem label={t('dashboard.mobileNav.library')} onClick={() => scrollTo('vocab-grid')}>
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden>
            <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5v-16Z" />
            <path d="M4 19h16v2H6.5A2.5 2.5 0 0 1 4 18.5" />
          </svg>
        </NavItem>

        <div className="flex h-14 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-semibold text-slate-400">
          <SettingsButton />
          <span className="max-w-full truncate leading-none">{t('dashboard.mobileNav.settings')}</span>
        </div>
      </div>
    </nav>
  );
}
