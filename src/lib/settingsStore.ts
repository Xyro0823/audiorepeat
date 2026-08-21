import { getSettings, putSettings } from '@/lib/db/indexedDb';
import type { AppSettings } from '@/types/app';
import { DEFAULT_SETTINGS } from '@/types/app';

/**
 * Module-level settings store.
 *
 * `useLists()` is a plain hook — every call mounts its own `useState`, so
 * without a shared store a settings change made in one component (e.g. the
 * Settings modal) would never reach another mounted consumer (e.g. the
 * layout-level ThemeManager). This tiny store makes settings truly global:
 * any `saveSettings` writes propagate to every subscribed component on the
 * next render, and persistence to IndexedDB is debounced here, once.
 */
let settings: AppSettings = DEFAULT_SETTINGS;
let hydrated = false;
let persistTimer: number | null = null;
let refreshInFlight: Promise<void> | null = null;
let hydrateInFlight: Promise<void> | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  for (const l of listeners) l();
}

export function subscribeSettings(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Stable snapshot for useSyncExternalStore. */
export function getSettingsSnapshot(): AppSettings {
  return settings;
}

export function settingsHydrated(): boolean {
  return hydrated;
}

/** Load persisted settings once (idempotent across all hook instances).
 * Concurrent callers share the in-flight read: `hydrated` flips before the
 * async IndexedDB read finishes, so a second useLists consumer mounting
 * alongside the first must not proceed with DEFAULT_SETTINGS — it would
 * activate the account-prefs store from defaults and visually lose the
 * guest's free-language choice and hidden languages until a reload. */
export function hydrateSettings(): Promise<void> {
  if (hydrated) return Promise.resolve();
  if (hydrateInFlight) return hydrateInFlight;
  hydrateInFlight = (async () => {
    try {
      const stored = await getSettings();
      settings = {
        ...DEFAULT_SETTINGS,
        ...stored,
        // targetGapMs now lives in the 1-5s range; clamp any legacy stored value
        // (old default was 600ms) so the slider never shows an out-of-range value.
        targetGapMs: Math.min(
          5000,
          Math.max(1000, stored?.targetGapMs ?? DEFAULT_SETTINGS.targetGapMs),
        ),
      };
    } catch {
      settings = { ...DEFAULT_SETTINGS };
    } finally {
      hydrated = true;
      hydrateInFlight = null;
      emit();
    }
  })();
  return hydrateInFlight;
}

/**
 * Force a re-read of persisted settings and notify every subscriber. The store
 * only hydrates once, so plan changes made in ANOTHER tab (e.g. a checkout
 * finishing there) aren't observed until this is called — use it on refocus.
 */
export async function refreshSettings(): Promise<void> {
  // Coalesce concurrent calls: multiple focus listeners (several mounted
  // useLists instances, StrictMode double-effects) can fire one 'focus' event
  // simultaneously. Without this, two async reads would both resolve with the
  // same stale snapshot and the second would overwrite a just-applied update
  // (e.g. clearing hiddenLangs after an upgrade) before it persists.
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    try {
      const stored = await getSettings();
      settings = {
        ...DEFAULT_SETTINGS,
        ...stored,
        targetGapMs: Math.min(
          5000,
          Math.max(1000, stored?.targetGapMs ?? DEFAULT_SETTINGS.targetGapMs),
        ),
      };
    } catch {
      settings = { ...DEFAULT_SETTINGS };
    }
    emit();
  })();
  try {
    await refreshInFlight;
  } finally {
    refreshInFlight = null;
  }
}

function persist(): void {
  // Snapshot at schedule time: a later in-memory mutation (e.g. a concurrent
  // refreshSettings re-read) must never corrupt what this write commits.
  const snapshot = settings;
  if (persistTimer !== null) clearTimeout(persistTimer);
  persistTimer = window.setTimeout(() => {
    void putSettings(snapshot).catch((err) => console.error('[settings] save', err));
  }, 250);
}

/** Merge a patch into the global settings and notify every subscriber. */
export function updateSettings(patch: Partial<AppSettings>): void {
  settings = { ...settings, ...patch };
  emit();
  persist();
}

/** Full replace (backup restore) — not a merge. */
export function replaceSettingsFull(next: AppSettings): void {
  settings = next;
  emit();
  persist();
}

/** Adopt settings already committed by an atomic backup restore. */
export function adoptPersistedSettings(next: AppSettings): void {
  settings = next;
  emit();
}
