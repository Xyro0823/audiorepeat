"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useT } from "@/lib/i18n";
import {
  createUpdateCoordinator,
  SKIP_WAITING_MESSAGE,
} from "@/lib/pwa/updateFlow";

/**
 * Non-intrusive "Update available" affordance.
 *
 * A newly deployed service worker installs and then WAITS (sw.js no longer
 * auto-skips). This component notices the waiting worker, offers a small
 * dismissible action, and on accept posts SKIP_WAITING — the resulting
 * controllerchange triggers exactly one reload via the shared coordinator,
 * so reload loops are impossible.
 *
 * Dismissal is remembered for the session, keyed to the waiting worker's
 * script URL, so the same stale worker never nags twice but a NEWER deploy
 * still gets announced.
 */

const DISMISS_PREFIX = "audiorepeat-update-dismissed";

function dismissedKey(scriptUrl: string): string {
  return `${DISMISS_PREFIX}:${scriptUrl}`;
}

export default function UpdatePrompt() {
  const t = useT();
  const pathname = usePathname();
  const [waitingUrl, setWaitingUrl] = useState<string | null>(null);
  const flowRef = useRef(createUpdateCoordinator());

  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    const announce = (worker: ServiceWorker | null | undefined) => {
      // Only meaningful when this page is already controlled by a service
      // worker — otherwise there is nothing stale to update away from.
      if (!worker || !navigator.serviceWorker.controller) return;
      try {
        if (window.sessionStorage.getItem(dismissedKey(worker.scriptURL)) === "1") return;
      } catch {
        /* storage unavailable — still show the prompt */
      }
      setWaitingUrl(worker.scriptURL);
    };

    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        announce(reg.waiting);
        reg.addEventListener("updatefound", () => {
          const installing = reg.installing;
          if (!installing) return;
          installing.addEventListener("statechange", () => {
            if (installing.state === "installed") announce(installing);
          });
        });
      })
      .catch(() => {});

    const onControllerChange = () => {
      if (!flowRef.current.shouldReloadOnControllerChange()) return;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
  }, []);

  const acceptUpdate = useCallback(() => {
    if (!waitingUrl) return;
    flowRef.current.requestUpdate();
    navigator.serviceWorker.getRegistrations().then((regs) => {
      const waiting = regs
        .map((reg) => reg.waiting)
        .find((worker) => worker?.scriptURL === waitingUrl);
      if (!waiting) return;
      waiting.postMessage(SKIP_WAITING_MESSAGE);
      // Primary path: activation claims this tab → controllerchange above.
      // Fallback path: some browsers activate without a fresh
      // controllerchange here, so watch the worker directly. Both paths go
      // through the same one-shot guard, so there is still exactly ONE reload.
      waiting.addEventListener("statechange", () => {
        if (waiting.state === "activated" && flowRef.current.shouldReloadOnControllerChange()) {
          window.location.reload();
        }
      });
    });
  }, [waitingUrl]);

  const dismiss = useCallback(() => {
    if (!waitingUrl) return;
    try {
      window.sessionStorage.setItem(dismissedKey(waitingUrl), "1");
    } catch {
      /* ignore */
    }
    setWaitingUrl(null);
  }, [waitingUrl]);

  // Keep the prompt off the player page, where the fixed control bar lives.
  if (pathname?.startsWith("/player")) return null;
  if (!waitingUrl) return null;

  return (
    <div className="pointer-events-none fixed bottom-4 left-4 z-50 flex max-w-[calc(100vw-2rem)] justify-start">
      <div
        role="status"
        aria-live="polite"
        className="glass animate-fade-up pointer-events-auto flex items-center gap-3 rounded-2xl border-white/10 py-2 pl-3 pr-2 shadow-[0_10px_40px_rgba(0,0,0,0.5)]"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-neon-cyan to-neon-violet text-night-950">
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6" />
          </svg>
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">{t("dashboard.update.title")}</p>
          <p className="truncate text-[11px] text-slate-400">{t("dashboard.update.body")}</p>
        </div>
        <button
          type="button"
          onClick={acceptUpdate}
          className="ml-1 min-h-10 shrink-0 rounded-xl bg-neon-violet px-3 text-xs font-bold text-white transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-violet"
        >
          {t("dashboard.update.reload")}
        </button>
        <button
          type="button"
          onClick={dismiss}
          aria-label={t("dashboard.update.dismissAria")}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-slate-500 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-violet"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-3.5 w-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
      </div>
    </div>
  );
}
