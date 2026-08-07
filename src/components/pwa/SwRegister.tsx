"use client";

import { useEffect } from "react";

/**
 * Registers the service worker. Deliberately skipped in dev: caching hashed
 * build assets during `next dev` causes stale-content confusion. Run
 * `npm run build && npm start` to exercise the offline PWA.
 */
export default function SwRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register("/sw.js")
      .catch((err) => console.error("[SW] registration failed", err));
  }, []);
  return null;
}
