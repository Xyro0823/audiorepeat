import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearOnboardingState,
  markOnboardingPending,
  readOnboardingPending,
  readOnboardingRecord,
  saveOnboardingRecord,
  shouldShowOnboarding,
} from '@/lib/onboarding';
import type { AppSettings } from '@/types/app';

/**
 * The audit scenario this file guards: Free-language selection and hiddenLangs
 * are ACCOUNT-SPECIFIC entitlement state. Account A's choice must never leak
 * to Account B on the same browser, B's choice must never overwrite A's, a
 * guest's state must never contaminate an account, and a brand-new account
 * (onboarding pending) must never inherit another session's gating.
 *
 * The account-prefs store routes writes to the uid's own localStorage record;
 * the global settings record (IndexedDB) remains the guest/legacy store. Both
 * stores are mocked here so the routing and isolation logic is tested in pure
 * node (no IndexedDB, no real auth).
 */

const mocks = vi.hoisted(() => {
  const auth: { user: { id: string } | null } = { user: null };
  const settings: { plan: string; selectedFreeLang: string | null; hiddenLangs: string[] } = {
    plan: 'basic',
    selectedFreeLang: null,
    hiddenLangs: [],
  };
  return { auth, settings };
});

vi.mock('@/lib/authStore', () => ({
  getAuthSnapshot: () => mocks.auth,
}));

vi.mock('@/lib/settingsStore', () => ({
  getSettingsSnapshot: () => mocks.settings,
  updateSettings: (patch: Record<string, unknown>) => {
    Object.assign(mocks.settings, patch);
  },
}));

import {
  ACCOUNT_PREFS_KEY_PREFIX,
  accountPrefsKey,
  activateAccountPrefs,
  EMPTY_ACCOUNT_PREFS,
  getAccountPrefsSnapshot,
  normalizeAccountPrefs,
  readAccountPrefs,
  updateAccountPrefs,
  writeAccountPrefs,
} from '@/lib/accountPrefs';

/** Minimal in-memory Storage for the node test environment. */
function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    key: (i: number) => [...map.keys()][i] ?? null,
    removeItem: (k: string) => {
      map.delete(k);
    },
    setItem: (k: string, v: string) => {
      map.set(k, String(v));
    },
  } as unknown as Storage;
}

let mem: Storage;

const asSettings = (): AppSettings => mocks.settings as unknown as AppSettings;

beforeEach(() => {
  mem = memoryStorage();
  (globalThis as unknown as { window: unknown }).window = { localStorage: mem };
  mocks.auth.user = null;
  mocks.settings.plan = 'basic';
  mocks.settings.selectedFreeLang = null;
  mocks.settings.hiddenLangs = [];
});

afterEach(() => {
  (globalThis as unknown as { window: unknown }).window = undefined;
});

describe('accountPrefsKey', () => {
  it('scopes per uid and keeps the guest key separate', () => {
    const a = accountPrefsKey('uid-a');
    expect(a).not.toBe(accountPrefsKey('uid-b'));
    expect(a.startsWith(ACCOUNT_PREFS_KEY_PREFIX)).toBe(true);
    expect(accountPrefsKey(null)).toBe(ACCOUNT_PREFS_KEY_PREFIX);
    expect(accountPrefsKey('uid-a')).not.toBe(accountPrefsKey(null));
  });
});

describe('normalizeAccountPrefs', () => {
  it('normalizes garbage to safe empty values', () => {
    expect(normalizeAccountPrefs(null)).toEqual(EMPTY_ACCOUNT_PREFS);
    expect(normalizeAccountPrefs(undefined)).toEqual(EMPTY_ACCOUNT_PREFS);
    expect(normalizeAccountPrefs('nope')).toEqual(EMPTY_ACCOUNT_PREFS);
  });

  it('keeps valid strings and drops invalid hidden entries', () => {
    expect(
      normalizeAccountPrefs({ selectedFreeLang: 'mn', hiddenLangs: ['es', 5, null, 'fr'] }),
    ).toEqual({ selectedFreeLang: 'mn', hiddenLangs: ['es', 'fr'] });
    expect(normalizeAccountPrefs({ selectedFreeLang: 42, hiddenLangs: 'es' })).toEqual(
      EMPTY_ACCOUNT_PREFS,
    );
  });
});

describe('account isolation (the A → B → A audit scenario)', () => {
  it("Account A's selection never appears for Account B", () => {
    writeAccountPrefs('A', { selectedFreeLang: 'mn', hiddenLangs: [] });
    expect(readAccountPrefs('B')).toBeNull();
  });

  it("B still gets its own onboarding (pending marker + record are per-uid)", () => {
    writeAccountPrefs('A', { selectedFreeLang: 'mn', hiddenLangs: ['es'] });
    markOnboardingPending('A');
    saveOnboardingRecord('A', {
      lang: 'mn',
      level: 'A1',
      goal: 'general',
      completed: true,
      version: 1,
    });
    // B is a brand-new account: its OWN pending marker is set and its own
    // record is empty, so B sees onboarding even though A already completed it.
    markOnboardingPending('B');
    expect(readOnboardingPending('B')).toBe(true);
    expect(readOnboardingRecord('B')).toBeNull();
    expect(shouldShowOnboarding(readOnboardingPending('B'), readOnboardingRecord('B'))).toBe(true);
    expect(shouldShowOnboarding(readOnboardingPending('A'), readOnboardingRecord('A'))).toBe(false);
  });

  it("B's selection does not overwrite A's", () => {
    writeAccountPrefs('A', { selectedFreeLang: 'mn', hiddenLangs: [] });
    writeAccountPrefs('B', { selectedFreeLang: 'fr', hiddenLangs: ['mn'] });
    expect(readAccountPrefs('A')).toEqual({ selectedFreeLang: 'mn', hiddenLangs: [] });
    expect(readAccountPrefs('B')).toEqual({ selectedFreeLang: 'fr', hiddenLangs: ['mn'] });
  });

  it('returning to A restores A exactly', () => {
    writeAccountPrefs('A', { selectedFreeLang: 'mn', hiddenLangs: [] });
    writeAccountPrefs('B', { selectedFreeLang: 'fr', hiddenLangs: [] });
    mocks.auth.user = { id: 'A' };
    activateAccountPrefs('A', asSettings(), {});
    expect(getAccountPrefsSnapshot()).toEqual({ selectedFreeLang: 'mn', hiddenLangs: [] });
  });

  it('guest state (global settings) never leaks into an account record', () => {
    mocks.auth.user = null;
    updateAccountPrefs({ selectedFreeLang: 'es', hiddenLangs: ['fr'] });
    expect(mocks.settings.selectedFreeLang).toBe('es');
    expect(mocks.settings.hiddenLangs).toEqual(['fr']);
    expect(readAccountPrefs('A')).toBeNull();
    expect(readAccountPrefs('B')).toBeNull();
  });

  it("a signed-in uid's record is untouched by guest writes", () => {
    writeAccountPrefs('A', { selectedFreeLang: 'mn', hiddenLangs: [] });
    mocks.auth.user = null;
    updateAccountPrefs({ selectedFreeLang: 'es' });
    expect(readAccountPrefs('A')).toEqual({ selectedFreeLang: 'mn', hiddenLangs: [] });
  });

  it('clearOnboardingState removes only that uid keys (A clean, B intact)', () => {
    markOnboardingPending('A');
    saveOnboardingRecord('A', { lang: 'mn' });
    markOnboardingPending('B');
    clearOnboardingState('A');
    expect(readOnboardingPending('A')).toBe(false);
    expect(readOnboardingRecord('A')).toBeNull();
    expect(readOnboardingPending('B')).toBe(true);
  });
});

describe('legacy adoption (hiddenLangs migration)', () => {
  it('adopts the legacy global hiddenLangs once for a signed-in uid with no record', () => {
    mocks.settings.hiddenLangs = ['de'];
    mocks.auth.user = { id: 'A' };
    activateAccountPrefs('A', asSettings(), {});
    expect(getAccountPrefsSnapshot()).toEqual({ selectedFreeLang: null, hiddenLangs: ['de'] });
    expect(readAccountPrefs('A')).toEqual({ selectedFreeLang: null, hiddenLangs: ['de'] });
  });

  it('skips adoption entirely while onboarding is pending (brand-new account)', () => {
    mocks.settings.hiddenLangs = ['de'];
    mocks.auth.user = { id: 'B' };
    activateAccountPrefs('B', asSettings(), { skipAdoption: true });
    expect(getAccountPrefsSnapshot()).toEqual(EMPTY_ACCOUNT_PREFS);
    // Nothing written: B never inherits the guest/legacy hidden state.
    expect(readAccountPrefs('B')).toBeNull();
  });

  it('an existing record always wins over the global state', () => {
    writeAccountPrefs('A', { selectedFreeLang: 'mn', hiddenLangs: ['fr'] });
    mocks.settings.hiddenLangs = ['de'];
    mocks.auth.user = { id: 'A' };
    activateAccountPrefs('A', asSettings(), {});
    expect(getAccountPrefsSnapshot()).toEqual({ selectedFreeLang: 'mn', hiddenLangs: ['fr'] });
  });
});

describe('updateAccountPrefs routing + merging', () => {
  it('signed-in writes land in the uid record, never the global settings', () => {
    mocks.auth.user = { id: 'A' };
    activateAccountPrefs('A', asSettings(), {});
    updateAccountPrefs({ selectedFreeLang: 'fr' });
    expect(readAccountPrefs('A')?.selectedFreeLang).toBe('fr');
    expect(mocks.settings.selectedFreeLang).toBeNull();
  });

  it('merges patches without dropping the other field', () => {
    mocks.auth.user = { id: 'A' };
    activateAccountPrefs('A', asSettings(), {});
    updateAccountPrefs({ selectedFreeLang: 'fr' });
    updateAccountPrefs({ hiddenLangs: ['es'] });
    expect(readAccountPrefs('A')).toEqual({ selectedFreeLang: 'fr', hiddenLangs: ['es'] });
  });

  it('is safe before activation: merges against the stored record, not an empty default', () => {
    writeAccountPrefs('A', { selectedFreeLang: 'mn', hiddenLangs: ['es'] });
    mocks.auth.user = { id: 'A' };
    // Re-target the store away from A — e.g. onboarding finishing before the
    // dashboard ever mounted, so the store was never activated for A.
    activateAccountPrefs(null, asSettings(), {});
    updateAccountPrefs({ hiddenLangs: ['de'] });
    expect(readAccountPrefs('A')).toEqual({ selectedFreeLang: 'mn', hiddenLangs: ['de'] });
  });

  it('a fresh account completing onboarding gets exactly its own choice', () => {
    mocks.auth.user = { id: 'B' };
    activateAccountPrefs('B', asSettings(), { skipAdoption: true });
    updateAccountPrefs({ selectedFreeLang: 'fr', hiddenLangs: ['mn', 'es'] });
    expect(readAccountPrefs('B')).toEqual({ selectedFreeLang: 'fr', hiddenLangs: ['mn', 'es'] });
    expect(readAccountPrefs('A')).toBeNull();
  });
});
