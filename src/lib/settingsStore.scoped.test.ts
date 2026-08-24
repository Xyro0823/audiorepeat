import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppSettings } from '@/types/app';
import { DEFAULT_SETTINGS } from '@/types/app';

/**
 * Behavioral regression tests for account-scoped settings switching:
 * Guest → User A → logout → User B → back to A. The store must reset to
 * fail-closed defaults the instant the owner changes, cancel any write still
 * sitting in the debounce window (the previous account's values must never
 * land in the next account's database), and rehydrate each account's OWN
 * persisted record on return.
 */
const h = vi.hoisted(() => ({
  // Emulates the owner-scoped IndexedDB layout: guest + one record per uid.
  scopes: new Map<string, AppSettings | null>(),
  // Mirrors activateSetOwner: which database getSettings/putSettings hit.
  scope: 'guest' as string,
}));

vi.mock('@/lib/db/indexedDb', () => ({
  getSettings: async () => h.scopes.get(h.scope) ?? null,
  putSettings: async (settings: AppSettings) => {
    h.scopes.set(h.scope, settings);
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

/** Production ordering: authStore activates the store, the db scope flips. */
function activateAs(store: Awaited<ReturnType<typeof freshStore>>, uid: string | null): void {
  store.activateSettingsOwner(uid);
  h.scope = uid ?? 'guest';
}

async function flushWrites(): Promise<void> {
  await new Promise((r) => setTimeout(r, 5));
}

beforeEach(() => {
  h.scopes.clear();
  h.scope = 'guest';
});

describe('settings store account scoping', () => {
  it('Guest → A → logout → B → A: each account sees only its own settings', async () => {
    const store = await freshStore();

    // Guest customizes theme + voice; persists in the legacy/guest scope.
    activateAs(store, null);
    await store.hydrateSettings();
    store.updateSettings({ theme: 'dark', targetVoiceURI: 'guest-voice' });
    await flushWrites();
    expect(h.scopes.get('guest')?.theme).toBe('dark');

    // Guest signs in as A: defaults immediately — never the guest's theme.
    activateAs(store, 'user-a');
    expect(store.getSettingsSnapshot()).toEqual(DEFAULT_SETTINGS);
    await store.hydrateSettings();
    store.updateSettings({ theme: 'light', targetVoiceURI: 'a-voice', speed: 1.4 });
    await flushWrites();

    // Logout → B: defaults again, and B's own choices stay isolated.
    activateAs(store, 'user-b');
    await store.hydrateSettings();
    expect(store.getSettingsSnapshot().theme).not.toBe('light');
    store.updateSettings({ theme: 'dark', repeats: 4 });
    await flushWrites();

    // Back to A: A's voice/speed/theme return exactly as saved.
    activateAs(store, 'user-a');
    await store.hydrateSettings();
    expect(store.getSettingsSnapshot().theme).toBe('light');
    expect(store.getSettingsSnapshot().targetVoiceURI).toBe('a-voice');
    expect(store.getSettingsSnapshot().speed).toBe(1.4);
    expect(store.getSettingsSnapshot().repeats).toBe(DEFAULT_SETTINGS.repeats);

    // Logout again: the guest's own dark theme comes back untouched.
    activateAs(store, null);
    await store.hydrateSettings();
    expect(store.getSettingsSnapshot().theme).toBe('dark');
    expect(h.scopes.get('user-b')?.repeats).toBe(4);
  });

  it('resets to fail-closed defaults synchronously when the owner changes', async () => {
    const store = await freshStore();
    activateAs(store, 'user-a');
    await store.hydrateSettings();
    store.updateSettings({ plan: 'pro', cloudTts: true });
    // No hydration, no tick — the very next render after a logout/login must
    // never observe the previous account's settings.
    store.activateSettingsOwner(null);
    expect(store.getSettingsSnapshot()).toEqual(DEFAULT_SETTINGS);
    expect(store.getSettingsSnapshot().plan).toBe('basic');
    expect(store.settingsHydrated()).toBe(false);
  });

  it('cancels a pending debounced write so it cannot cross accounts', async () => {
    const store = await freshStore();
    activateAs(store, 'user-a');
    await store.hydrateSettings();
    store.updateSettings({ theme: 'light', showHints: true });
    // Account switch happens INSIDE the 250ms debounce window…
    store.activateSettingsOwner('user-b');
    h.scope = 'user-b';
    // …and the old write must never commit into B's (or any) scope.
    await flushWrites();
    expect(h.scopes.get('user-a')).toBeUndefined();
    expect(h.scopes.get('user-b')).toBeUndefined();
    // Hydration afterwards is unaffected by the cancelled write.
    await store.hydrateSettings();
    expect(store.getSettingsSnapshot()).toEqual(DEFAULT_SETTINGS);
  });

  it('a pre-hydration entitlement reset never clobbers the stored record', async () => {
    const store = await freshStore();
    // Simulate authStore's login chain: activation → sync reset → hydration
    // of an account whose stored mirror says Pro.
    activateAs(store, 'user-a');
    store.updateSettings({ plan: 'basic', planBilling: 'annual', planSource: null });
    h.scopes.set('user-a', { ...DEFAULT_SETTINGS, plan: 'pro', planSource: 'paddle' });
    await store.hydrateSettings();
    // Stored truth wins over the transitional write; the pending basic write
    // was cancelled instead of persisting over the account's real plan.
    expect(store.getSettingsSnapshot().plan).toBe('pro');
    await flushWrites();
    expect(h.scopes.get('user-a')?.plan).toBe('pro');
  });

  it('persists across reload/restart for the same account', async () => {
    // Session 1: A saves preferences.
    let store = await freshStore();
    activateAs(store, 'user-a');
    await store.hydrateSettings();
    store.updateSettings({ reminderTime: '07:30', cachedAudio: true });
    await flushWrites();

    // Session 2 ("app restart"): fresh module, same storage, same account.
    store = await freshStore();
    activateAs(store, 'user-a');
    await store.hydrateSettings();
    expect(store.getSettingsSnapshot().reminderTime).toBe('07:30');
    expect(store.getSettingsSnapshot().cachedAudio).toBe(true);
  });
});
