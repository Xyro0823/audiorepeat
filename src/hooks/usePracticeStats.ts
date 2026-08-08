'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { computeStreak, dayKey, lastNDays, type DayMap } from '@/lib/practiceStats';

const STORAGE_KEY = 'audiorepeat-stats-v1';

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

export interface PracticeStats {
  wordsToday: number;
  msToday: number;
  streak: number;
}

/**
 * Daily practice stats: streak, words listened today, and study time today.
 * Stored per-day in localStorage; reads are SSR-safe and cheap.
 * `days` (the full per-day map) and `week` (rolling 7-day view) power the
 * home summary card and the dedicated Stats page.
 */
export function usePracticeStats() {
  // Start empty: the home page is server-rendered, so reading localStorage in
  // the initializer would mismatch the prerendered HTML during hydration.
  const [days, setDays] = useState<DayMap>({});
  const [loaded, setLoaded] = useState(false);
  const daysRef = useRef(days);

  useEffect(() => {
    daysRef.current = days;
  }, [days]);

  // Load persisted stats after first paint (stats pop in a frame later).
  // Deferred so it's safe for SSR/hydration and doesn't clobber stored data
  // with the initial empty state before the load lands.
  useEffect(() => {
    const id = window.requestAnimationFrame(() => {
      setLoaded(true);
      setDays(loadDays());
    });
    return () => window.cancelAnimationFrame(id);
  }, []);

  // Persist on every change — the payloads are tiny, no debounce needed.
  useEffect(() => {
    if (!loaded) return; // never overwrite stored stats with the empty state
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(days));
    } catch {
      /* storage unavailable */
    }
  }, [days, loaded]);

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

  const recordWords = useCallback((n: number, lang?: string) => {
    if (!(n > 0)) return;
    setDays((prev) => {
      const k = dayKey(new Date());
      const cur = prev[k] ?? { w: 0, ms: 0 };
      let langs = cur.langs ? { ...cur.langs } : undefined;
      if (lang) {
        const l = (langs?.[lang] ?? { w: 0, ms: 0 });
        langs = { ...(langs ?? {}), [lang]: { w: l.w + n, ms: l.ms } };
      }
      return { ...prev, [k]: { w: cur.w + n, ms: cur.ms, ...(langs ? { langs } : {}) } };
    });
  }, []);

  const recordMs = useCallback((ms: number, lang?: string) => {
    if (!(ms > 0)) return;
    setDays((prev) => {
      const k = dayKey(new Date());
      const cur = prev[k] ?? { w: 0, ms: 0 };
      let langs = cur.langs ? { ...cur.langs } : undefined;
      if (lang) {
        const l = (langs?.[lang] ?? { w: 0, ms: 0 });
        langs = { ...(langs ?? {}), [lang]: { w: l.w, ms: l.ms + ms } };
      }
      return { ...prev, [k]: { w: cur.w, ms: cur.ms + ms, ...(langs ? { langs } : {}) } };
    });
  }, []);

  const stats = useMemo<PracticeStats>(() => {
    const t = days[dayKey(new Date())] ?? { w: 0, ms: 0 };
    return { wordsToday: t.w, msToday: t.ms, streak: computeStreak(days) };
  }, [days]);

  // Rolling 7-day view (oldest → today) for the weekly activity heatmap.
  const week = useMemo(() => lastNDays(days, 7), [days]);

  return { ...stats, week, days, loaded, recordWords, recordMs };
}
