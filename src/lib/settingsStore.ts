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

/** Load persisted settings once (idempotent across all hook instances). */
export async function hydrateSettings(): Promise<void> {
  if (hydrated) return;
  hydrated = true;
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
  }
  emit();
}

function persist(): void {
  if (persistTimer !== null) clearTimeout(persistTimer);
  persistTimer = window.setTimeout(() => {
    void putSettings(settings).catch((err) => console.error('[settings] save', err));
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
