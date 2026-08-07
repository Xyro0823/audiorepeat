'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const STORAGE_KEY = 'audiorepeat-stats-v1';

interface DayStat {
  w: number; // words listened
  ms: number; // study time (ms)
}

type DayMap = Record<string, DayStat>;

function dayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function loadDays(): DayMap {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DayMap;
      if (parsed && typeof parsed === 'object') return parsed;
    }
  } catch {
    /* corrupted storage — start fresh */
  }
  return {};
}

/** Consecutive practiced days ending today (or yesterday, so the flame doesn't flicker off mid-day). */
function computeStreak(days: DayMap): number {
  const cursor = new Date();
  if (!days[dayKey(cursor)]) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (days[dayKey(cursor)]) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export interface PracticeStats {
  wordsToday: number;
  msToday: number;
  streak: number;
}

/**
 * Daily practice stats: streak, words listened today, and study time today.
 * Stored per-day in localStorage; reads are SSR-safe and cheap.
 */
export function usePracticeStats() {
  // Start empty: the home page is server-rendered, so reading localStorage in
  // the initializer would mismatch the prerendered HTML during hydration.
  const [days, setDays] = useState<DayMap>({});
  const daysRef = useRef(days);
  const loadedRef = useRef(false);

  useEffect(() => {
    daysRef.current = days;
  }, [days]);

  // Load persisted stats after first paint (stats pop in a frame later).
  // Deferred so it's safe for SSR/hydration and doesn't clobber stored data
  // with the initial empty state before the load lands.
  useEffect(() => {
    const id = window.requestAnimationFrame(() => {
      loadedRef.current = true;
      setDays(loadDays());
    });
    return () => window.cancelAnimationFrame(id);
  }, []);

  // Persist on every change — the payloads are tiny, no debounce needed.
  useEffect(() => {
    if (!loadedRef.current) return; // never overwrite stored stats with the empty state
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(days));
    } catch {
      /* storage unavailable */
    }
  }, [days]);

  // Flush immediately when the tab is hidden (e.g. the screen locks mid-playback),
  // so background practice time is never lost.
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        try {
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(daysRef.current));
        } catch {
          /* ignore */
        }
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  const recordWords = useCallback((n: number) => {
    if (!(n > 0)) return;
    setDays((prev) => {
      const k = dayKey(new Date());
      const cur = prev[k] ?? { w: 0, ms: 0 };
      return { ...prev, [k]: { w: cur.w + n, ms: cur.ms } };
    });
  }, []);

  const recordMs = useCallback((ms: number) => {
    if (!(ms > 0)) return;
    setDays((prev) => {
      const k = dayKey(new Date());
      const cur = prev[k] ?? { w: 0, ms: 0 };
      return { ...prev, [k]: { w: cur.w, ms: cur.ms + ms } };
    });
  }, []);

  const stats = useMemo<PracticeStats>(() => {
    const t = days[dayKey(new Date())] ?? { w: 0, ms: 0 };
    return { wordsToday: t.w, msToday: t.ms, streak: computeStreak(days) };
  }, [days]);

  return { ...stats, recordWords, recordMs };
}
