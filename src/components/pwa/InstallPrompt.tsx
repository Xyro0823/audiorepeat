"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Chrome/Edge `beforeinstallprompt` event (not in lib.dom yet). */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "audiorepeat-install-dismissed";

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return (
    /iphone|ipad|ipod/i.test(ua) ||
    // iPadOS 13+ reports as a Mac
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function wasDismissed(): boolean {
  try {
    return window.localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Install-to-home-screen affordance.
 * - Android / Chrome desktop: captures `beforeinstallprompt` and offers an
 *   "Install app" button that triggers the native install dialog.
 * - iOS Safari: has no install prompt event, so it shows a dismissible hint
 *   ("Share → Add to Home Screen") when the app isn't already standalone.
 * Hides permanently after installation or when dismissed.
 */
export default function InstallPrompt() {
  const [installEvt, setInstallEvt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosHint, setShowIosHint] = useState(() => {
    if (isStandalone()) return false;
    return isIOS() && !wasDismissed();
  });
  const [installed, setInstalled] = useState(false);
  const dismissedRef = useRef(false);

  useEffect(() => {
    if (isStandalone()) return;
    dismissedRef.current = wasDismissed();

    const onPrompt = (e: Event) => {
      if (dismissedRef.current) return;
      e.preventDefault();
      setInstallEvt(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setInstallEvt(null);
      setShowIosHint(false);
      try {
        window.localStorage.setItem(DISMISS_KEY, "1");
      } catch {
        /* ignore */
      }
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const dismiss = useCallback(() => {
    dismissedRef.current = true;
    setInstallEvt(null);
    setShowIosHint(false);
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
  }, []);

  const install = useCallback(async () => {
    if (!installEvt) return;
    await installEvt.prompt();
    await installEvt.userChoice;
    setInstallEvt(null);
  }, [installEvt]);

  if (installed || (!installEvt && !showIosHint)) return null;

  const closeBtn = (
    <button
      onClick={dismiss}
      aria-label="Dismiss"
      className="ml-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-slate-500 transition hover:bg-white/10 hover:text-white"
    >
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
        <path d="M6 6l12 12M18 6 6 18" />
      </svg>
    </button>
  );

  return (
    <div className="fixed right-3 top-3 z-50 animate-fade-up sm:right-5 sm:top-5">
      {installEvt ? (
        <div className="glass flex items-center gap-3 rounded-2xl p-3 pr-4 shadow-2xl">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-neon-cyan to-neon-violet text-night-950">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3v12m0 0 4-4m-4 4-4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
            </svg>
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white">Install AudioRepeat</p>
            <p className="text-[11px] text-slate-400">Use it like an app — works offline</p>
          </div>
          <button
            onClick={() => void install()}
            className="ml-1 shrink-0 rounded-xl bg-gradient-to-r from-neon-cyan to-neon-violet px-4 py-2 text-sm font-semibold text-night-950 transition hover:brightness-110 active:scale-95"
          >
            Install
          </button>
          {closeBtn}
        </div>
      ) : (
        <div className="glass flex max-w-xs items-center gap-3 rounded-2xl p-3 pr-4 shadow-2xl">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-neon-magenta to-neon-violet text-night-950">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="4" y="3" width="16" height="18" rx="2" />
              <path d="M9 8h6M9 12h6M9 16h3" />
            </svg>
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white">Add to Home Screen</p>
            <p className="text-[11px] leading-snug text-slate-400">
              Tap <span className="font-medium text-slate-300">Share</span>, then{" "}
              <span className="font-medium text-slate-300">Add to Home Screen</span> for a
              full-screen app experience.
            </p>
          </div>
          {closeBtn}
        </div>
      )}
    </div>
  );
}
