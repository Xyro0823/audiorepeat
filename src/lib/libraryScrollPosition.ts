const STORAGE_KEY = 'audiorepeat:dashboard-scroll-position';

/** Remember where the learner was in the library before opening a set. */
export function saveDashboardScrollPosition(top: number): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, String(Math.max(0, Math.round(top))));
  } catch {
    // Storage can be unavailable in private browsing; navigation still works.
  }
}

/** Consume a one-time library return position so normal dashboard visits open at top. */
export function takeDashboardScrollPosition(): number | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    window.sessionStorage.removeItem(STORAGE_KEY);
    const top = raw === null ? Number.NaN : Number(raw);
    return Number.isFinite(top) && top >= 0 ? top : null;
  } catch {
    return null;
  }
}

/** True only for a player page opened from this browser session's library. */
export function hasDashboardScrollPosition(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.sessionStorage.getItem(STORAGE_KEY) !== null;
  } catch {
    return false;
  }
}
