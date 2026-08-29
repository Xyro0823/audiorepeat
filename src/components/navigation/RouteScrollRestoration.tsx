'use client';

import { useEffect, useLayoutEffect } from 'react';
import { usePathname } from 'next/navigation';

const STORAGE_PREFIX = 'audiorepeat:route-scroll:';

function storageKey(pathname: string): string {
  return `${STORAGE_PREFIX}${pathname}`;
}

function readPosition(pathname: string): number | null {
  try {
    const raw = window.sessionStorage.getItem(storageKey(pathname));
    const top = raw === null ? Number.NaN : Number(raw);
    return Number.isFinite(top) && top >= 0 ? top : null;
  } catch {
    return null;
  }
}

function writePosition(pathname: string): void {
  try {
    window.sessionStorage.setItem(storageKey(pathname), String(Math.max(0, Math.round(window.scrollY))));
  } catch {
    // Private browsing or blocked storage should never prevent navigation.
  }
}

/**
 * Keeps one scroll position per app route for the current browser session.
 * Next links normally start the destination at the top; this restores a
 * previously visited route after that transition, including browser Back.
 */
export default function RouteScrollRestoration() {
  const pathname = usePathname() ?? '/';

  useEffect(() => {
    const previous = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';
    return () => {
      window.history.scrollRestoration = previous;
    };
  }, []);

  useEffect(() => {
    let frame: number | null = null;
    const save = () => {
      frame = null;
      writePosition(pathname);
    };
    const onScroll = () => {
      if (frame === null) frame = window.requestAnimationFrame(save);
    };
    const onPageHide = () => writePosition(pathname);

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('pagehide', onPageHide);
    return () => {
      if (frame !== null) window.cancelAnimationFrame(frame);
      writePosition(pathname);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('pagehide', onPageHide);
    };
  }, [pathname]);

  useLayoutEffect(() => {
    const top = readPosition(pathname);
    if (top === null) return;
    // The second frame runs after a route transition's built-in top scroll
    // and after the destination has committed its initial layout.
    window.scrollTo({ top, behavior: 'auto' });
    const frame = window.requestAnimationFrame(() => window.scrollTo({ top, behavior: 'auto' }));
    return () => window.cancelAnimationFrame(frame);
  }, [pathname]);

  return null;
}
