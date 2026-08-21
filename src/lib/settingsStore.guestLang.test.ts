import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppSettings } from '@/types/app';
import { DEFAULT_SETTINGS } from '@/types/app';

/**
 * Guards the guest language-switch persistence path with the REAL settings
 * store: (1) concurrent hydration must never hand a caller DEFAULT_SETTINGS
 * while the IndexedDB read is in flight — the guest's free-language choice
 * and hidden languages would be mirrored into the account-prefs store as
 * empty and visually lost until a reload; (2) a change-language write must
 * survive the debounced write + re-hydration exactly.
 */
const store = vi.hoisted(() => ({ persisted: null as AppSettings | null }));

vi.mock('@/lib/db/indexedDb', () => ({
  getSettings: async () => {
    // Realistic async IDB latency so the hydration race is observable.
    await new Promise((r) => setTimeout(r, 10));
    return store.persisted;
  },
  putSettings: async (settings: AppSettings) => {
    store.persisted = settings;
  },
}));

// The store debounces its write with window.setTimeout — provide it in node.
vi.stubGlobal('window', {
  setTimeout: (fn: () => void) => setTimeout(fn, 0) as unknown as number,
  clearTimeout: (id: number) => clearTimeout(id as unknown as ReturnType<typeof setTimeout>),
});

async function freshStore() {
  vi.resetModules();
  return import('./settingsStore');
}

describe('settings store guest language-switch persistence', () => {
  beforeEach(() => {
    store.persisted = null;
  });

  it('a concurrent hydrate caller never observes defaults before the read lands', async () => {
    store.persisted = {
      ...DEFAULT_SETTINGS,
      selectedFreeLang: 'fr',
      hiddenLangs: ['es', 'mn'],
    };
    const { hydrateSettings, getSettingsSnapshot } = await freshStore();
    // Two useLists consumers hydrating simultaneously (dashboard + modal).
    const p1 = hydrateSettings();
    const p2 = hydrateSettings();
    // The second caller must resolve only after the stored record is applied.
    await p2;
    expect(getSettingsSnapshot().selectedFreeLang).toBe('fr');
    expect(getSettingsSnapshot().hiddenLangs).toEqual(['es', 'mn']);
    await p1;
  });

  it('keeps selectedFreeLang AND hiddenLangs through the debounced write', async () => {
    const { hydrateSettings, getSettingsSnapshot, updateSettings } = await freshStore();
    await hydrateSettings();
    // The change-language modal's guest write:
    updateSettings({ selectedFreeLang: 'fr', hiddenLangs: ['es', 'mn'] });
    // persist() debounces — flush it (stubbed timers run immediately).
    await new Promise((r) => setTimeout(r, 5));

    expect(store.persisted).not.toBeNull();
    expect(store.persisted!.selectedFreeLang).toBe('fr');
    expect(store.persisted!.hiddenLangs).toEqual(['es', 'mn']);
    expect(getSettingsSnapshot().hiddenLangs).toEqual(['es', 'mn']);
  });
});
