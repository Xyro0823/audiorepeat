'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import {
  captureInstallEvent,
  getInstallSnapshot,
  requestInstall,
  subscribeInstall,
  type InstallEvent,
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
export default function InstallAppButton() {
  const installEvt = useSyncExternalStore(subscribeInstall, getInstallSnapshot, getInstallSnapshot);
  const [showHint, setShowHint] = useState(false);
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Capture the browser's one-shot install prompt into the shared store the
  // moment it fires, so this button (the only install affordance on
  // Chrome/Android) can offer the native dialog.
  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      captureInstallEvent(e as unknown as InstallEvent);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  const ios = isIOS();
  if (!installEvt && !ios) return null;

  const onClick = () => {
    if (installEvt) {
      setShowHint(false);
      void requestInstall();
      return;
    }
    // iOS: show a hint and auto-hide after a few seconds.
    setShowHint(true);
    if (hintTimer.current) clearTimeout(hintTimer.current);
    hintTimer.current = setTimeout(() => setShowHint(false), 4500);
  };

  return (
    <div className="relative">
      <button
        onClick={onClick}
        title="Install AudioRepeat as an app"
        aria-label="Install app"
        className="btn-toolbar-ghost flex h-10 items-center gap-1.5 rounded-lg px-3 text-xs font-medium text-slate-300"
      >
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4 text-neon-violet"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 3v12m0 0 4-4m-4 4-4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
        </svg>
        <span>Install</span>
      </button>

      {showHint && (
        <div className="dropdown-panel animate-fade-up absolute right-0 top-full z-[100] mt-2 w-60 rounded-2xl p-3.5">
          <p className="text-sm font-semibold text-white">Add to Home Screen</p>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
            Tap <span className="font-semibold text-slate-200">Share</span> in Safari, then{' '}
            <span className="font-semibold text-slate-200">Add to Home Screen</span> to install
            AudioRepeat like an app.
          </p>
        </div>
      )}
    </div>
  );
}
