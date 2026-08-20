'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Download } from 'lucide-react';
import {
  getInstallSnapshot,
  requestInstall,
  subscribeInstall,
} from '@/lib/installStore';

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
  variant?: 'toolbar' | 'landing' | 'checklist';
}) {
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

  return (
    <div className="relative">
      <button
        type="button"
        onClick={onClick}
        title="Install AudioRepeat as an app"
        aria-label="Install app"
        className={landing
          ? 'btn-neural inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full px-6 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200 sm:w-auto'
          : checklist
            ? 'inline-flex min-h-10 items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-4 text-xs font-semibold text-white transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300'
            : 'btn-toolbar-ghost flex h-11 items-center gap-1.5 rounded-xl px-3 text-xs font-medium text-slate-300'}
      >
        <Download className={`h-4 w-4 ${landing ? '' : 'text-neon-violet'}`} aria-hidden />
        <span className={variant === 'toolbar' ? 'hidden md:inline' : undefined}>
          {landing ? 'Install AudioRepeat' : 'Install App'}
        </span>
      </button>

      {showHint && (
        <div aria-live="polite" className={`dropdown-panel animate-fade-up absolute top-full z-[100] mt-2 w-64 max-w-[calc(100vw-3rem)] rounded-2xl p-3.5 ${landing ? 'left-0 sm:left-auto sm:right-0' : 'right-0'}`}>
          <p className="text-sm font-semibold text-white">Add to Home Screen</p>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
            {ios ? (
              <>Tap <span className="font-semibold text-slate-200">Share</span> in Safari, then <span className="font-semibold text-slate-200">Add to Home Screen</span>.</>
            ) : (
              <>Open your browser menu and choose <span className="font-semibold text-slate-200">Install AudioRepeat</span> or <span className="font-semibold text-slate-200">Install app</span>.</>
            )}
          </p>
        </div>
      )}
    </div>
  );
}
