"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

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
 * - Chrome / Android / desktop: the install entry lives in the top navbar
 *   ("Install App" button → native dialog) — no floating banner at all.
 * - iOS Safari: no install event exists, so a small dismissible
 *   "Share → Add to Home Screen" toast shows in the bottom-right corner.
 * Hides permanently after installation or when dismissed, and stays off the
 * player page where the fixed control bar lives.
 */
export default function InstallPrompt() {
  const [showIosHint, setShowIosHint] = useState(() => {
    if (isStandalone()) return false;
    return isIOS() && !wasDismissed();
  });
  const [installed, setInstalled] = useState(false);
  const dismissedRef = useRef(false);
  const pathname = usePathname();

  useEffect(() => {
    if (isStandalone()) return;
    dismissedRef.current = wasDismissed();

    const onInstalled = () => {
      setInstalled(true);
      setShowIosHint(false);
      try {
        window.localStorage.setItem(DISMISS_KEY, "1");
      } catch {
        /* ignore */
      }
    };
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const dismiss = useCallback(() => {
    dismissedRef.current = true;
    setShowIosHint(false);
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
  }, []);

  if (installed) return null;
  // Keep the floating nudge off the player page, where the control bar lives.
  if (pathname?.startsWith("/player")) return null;
  if (!showIosHint) return null;

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex justify-end">
      <div className="glass animate-fade-up pointer-events-auto flex max-w-xs items-center gap-3 rounded-2xl border-white/10 py-2 pl-3 pr-2 shadow-[0_10px_40px_rgba(0,0,0,0.5)]">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-neon-magenta to-neon-violet text-night-950">
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="4" y="3" width="16" height="18" rx="2" />
            <path d="M9 8h6M9 12h6M9 16h3" />
          </svg>
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">Add to Home Screen</p>
          <p className="truncate text-[11px] text-slate-400">
            Tap Share, then Add to Home Screen
          </p>
        </div>
        <button
          onClick={dismiss}
          aria-label="Dismiss"
          className="ml-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-slate-500 transition hover:bg-white/10 hover:text-white"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-3.5 w-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          >
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
      </div>
    </div>
  );
}
