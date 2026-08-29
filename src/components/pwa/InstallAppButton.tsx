'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { BriefcaseBusiness, Download, Monitor, Smartphone } from 'lucide-react';
import {
  getInstallSnapshot,
  requestInstall,
  subscribeInstall,
} from '@/lib/installStore';
import { useT } from '@/lib/i18n';

function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  return (
    /iphone|ipad|ipod/i.test(ua) ||
    // iPadOS 13+ reports as a Mac
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

/**
 * Sleek "Install App" button for the top navbar (no floating banner).
 * - Chrome / Android: the browser fired `beforeinstallprompt` → the button
 *   opens the native install dialog.
 * - iOS Safari: no install event exists → clicking shows a small
 *   "Share → Add to Home Screen" hint.
 * - Other browsers: hidden (install not supported).
 */
export default function InstallAppButton({
  variant = 'toolbar',
}: {
  variant?: 'toolbar' | 'landing' | 'checklist' | 'sidebar';
}) {
  const t = useT();
  const installEvt = useSyncExternalStore(subscribeInstall, getInstallSnapshot, getInstallSnapshot);
  const [showHint, setShowHint] = useState(false);
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (hintTimer.current) clearTimeout(hintTimer.current);
    };
  }, []);

  const ios = isIOS();
  const installSupported = Boolean(installEvt || ios);
  if (!installSupported && variant === 'toolbar') return null;

  const onClick = () => {
    if (installEvt) {
      setShowHint(false);
      void requestInstall();
      return;
    }
    // iOS and browsers without a captured native prompt: show manual steps.
    setShowHint(true);
    if (hintTimer.current) clearTimeout(hintTimer.current);
    hintTimer.current = setTimeout(() => setShowHint(false), 4500);
  };

  const landing = variant === 'landing';
  const checklist = variant === 'checklist';
  const sidebar = variant === 'sidebar';

  return (
    <div className={`relative ${sidebar ? 'group' : ''}`}>
      <button
        type="button"
        onClick={onClick}
        title={t('pwa.install.title')}
        aria-label={t('pwa.install.button')}
        className={sidebar
          ? 'btn-toolbar-ghost flex h-11 w-11 items-center justify-center rounded-xl text-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300'
          : landing
          ? 'btn-neural inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full px-6 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200 sm:w-auto'
          : checklist
            ? 'inline-flex min-h-10 items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-4 text-xs font-semibold text-white transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300'
            : 'btn-toolbar-ghost flex h-11 items-center gap-1.5 rounded-xl px-3 text-xs font-medium text-slate-300'}
      >
        {sidebar ? (
          <BriefcaseBusiness className="h-[18px] w-[18px] text-slate-300" strokeWidth={1.8} aria-hidden />
        ) : (
          <Download className={`h-4 w-4 ${landing ? '' : 'text-neon-violet'}`} aria-hidden />
        )}
        <span className={sidebar ? 'hidden' : variant === 'toolbar' ? 'hidden md:inline' : undefined}>
          {landing ? t('pwa.install.title') : t('pwa.install.button')}
        </span>
      </button>

      {sidebar && (
        <div className="invisible pointer-events-none absolute bottom-full left-0 z-[110] mb-2 w-60 rounded-2xl border border-white/10 bg-[#141720] p-2 opacity-0 shadow-2xl transition duration-150 group-hover:visible group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:visible group-focus-within:pointer-events-auto group-focus-within:opacity-100">
          <button type="button" onClick={onClick} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-slate-200 transition hover:bg-white/8 hover:text-white">
            <Monitor className="h-5 w-5 shrink-0" strokeWidth={1.8} aria-hidden /> Get AudioRepeat desktop
          </button>
          <button type="button" onClick={onClick} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-slate-200 transition hover:bg-white/8 hover:text-white">
            <Smartphone className="h-5 w-5 shrink-0" strokeWidth={1.8} aria-hidden /> Get AudioRepeat mobile
          </button>
        </div>
      )}

      {showHint && !sidebar && (
        <div aria-live="polite" className={`dropdown-panel animate-fade-up absolute top-full z-[100] mt-2 w-64 max-w-[calc(100vw-3rem)] rounded-2xl p-3.5 ${landing ? 'left-0 sm:left-auto sm:right-0' : 'right-0'}`}>
          <p className="text-sm font-semibold text-white">{t('dashboard.install.addTitle')}</p>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
            {ios ? (
              t('pwa.install.ios')
            ) : (
              <>
                {t('dashboard.install.menuPrefix')}{' '}
                <span className="font-semibold text-slate-200">{t('pwa.install.title')}</span>{' '}
                {t('dashboard.install.or')}{' '}
                <span className="font-semibold text-slate-200">{t('pwa.install.button')}</span>.
              </>
            )}
          </p>
        </div>
      )}
    </div>
  );
}
