import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppSettings } from '@/types/app';
import { DEFAULT_SETTINGS } from '@/types/app';

/**
 * i18n regression tests: dictionary parity (every key translated, every
 * placeholder preserved), translation behavior, and the account-scoped
 * persistence of the interface language (guest / User A / User B never see
 * each other's choice; a reload restores it).
 */
import { getDictionary, registerNamespaces } from './dictionaries';
import { ALL_BUNDLES } from './register/route';
// Register EVERY bundle: the integrity checks below double as the coverage
// invariant for the split registry — if a bundle forgets a namespace, its
// keys vanish from the merged table and these tests fail.
for (const bundle of ALL_BUNDLES) registerNamespaces(bundle);

describe('dictionary integrity', () => {
  const enKeys = Object.keys(getDictionary('en')).sort();
  const mnKeys = Object.keys(getDictionary('mn')).sort();

  it('translates every key — en/mn key sets are identical', () => {
    expect(mnKeys).toEqual(enKeys);
    expect(enKeys.length).toBeGreaterThan(300);
  });

  it('has no empty Mongolian values', () => {
    const mnTable = getDictionary('mn');
    for (const key of enKeys) {
      expect((mnTable[key] ?? '').trim(), key).not.toBe('');
    }
  });

  it('keeps {placeholder} names identical across locales', () => {
    const placeholderRe = /\{(\w+)\}/g;
    const en = getDictionary('en');
    const table = getDictionary('mn');
    for (const key of enKeys) {
      const grab = (value: string): string =>
        [...value.matchAll(placeholderRe)].map((m) => m[1]).sort().join(',');
      expect(grab(table[key]), key).toBe(grab(en[key]));
    }
  });

  it('keeps brand name AudioRepeat untouched in both locales', () => {
    const enTable = getDictionary('en');
    const tables: Array<[string, Record<string, string>]> = [
      ['en', getDictionary('en')],
      ['mn', getDictionary('mn')],
    ];
    for (const key of enKeys) {
      if (!enTable[key].includes('AudioRepeat')) continue;
      for (const [lang, table] of tables) {
        // If English mentions the brand, every locale must too (never localized).
        expect(table[key], `${lang}:${key}`).toContain('AudioRepeat');
      }
    }
  });
});

describe('translation behavior', () => {
  it('interpolates placeholders and falls back to English for unknown keys', async () => {
    const { translate } = await import('./index');
    expect(translate('en', 'sync.lastSynced', { time: '12:00' })).toBe('Last synced 12:00');
    expect(translate('mn', 'sync.lastSynced', { time: '12:00' })).toBe('Сүүлийн синк: 12:00');
    expect(translate('mn', 'no.such.key' as never)).toBe('no.such.key');
  });

  it('defaults to English before hydration', async () => {
    vi.resetModules();
    const i18n = await import('./index');
    expect(i18n.currentUiLang()).toBe('en');
    expect(i18n.t('common.save')).toBe('Save');
  });
});

/**
 * Persistence/isolation harness — mirrors settingsStore.scoped.test.ts:
 * owner-scoped fake IndexedDB plus the debounced-write window shim.
 */
const h = vi.hoisted(() => ({
  scopes: new Map<string, AppSettings | null>(),
  scope: 'guest' as string,
}));

vi.mock('@/lib/db/indexedDb', () => ({
  getSettings: async () => h.scopes.get(h.scope) ?? null,
  putSettings: async (settings: AppSettings) => {
    h.scopes.set(h.scope, settings);
  },
}));

vi.stubGlobal('window', {
  setTimeout: (fn: () => void) => setTimeout(fn, 0) as unknown as number,
  clearTimeout: (id: number) => clearTimeout(id as unknown as ReturnType<typeof setTimeout>),
});

/** Production ordering: authStore activates the store, the db scope flips. */
function activateAs(store: typeof import('@/lib/settingsStore'), uid: string | null): void {
  store.activateSettingsOwner(uid);
  h.scope = uid ?? 'guest';
}

async function freshModules() {
  vi.resetModules();
  const store = await import('@/lib/settingsStore');
  const i18n = await import('./index');
  return { store, i18n };
}

async function flushWrites(): Promise<void> {
  await new Promise((r) => setTimeout(r, 5));
}

beforeEach(() => {
  h.scopes.clear();
  h.scope = 'guest';
});

describe('ui language persistence & isolation', () => {
  it('Guest → A → B → guest: each scope keeps its own interface language', async () => {
    let { store, i18n } = await freshModules();

    // Guest switches the UI to Mongolian; persists to the guest scope.
    activateAs(store, null);
    await store.hydrateSettings();
    i18n.setUiLang('mn');
    await flushWrites();
    expect(h.scopes.get('guest')?.uiLang).toBe('mn');
    expect(store.getSettingsSnapshot().uiLang).toBe('mn');

    // Guest signs in as A: English defaults — never the guest's choice…
    activateAs(store, 'user-a');
    expect(store.getSettingsSnapshot().uiLang).toBe('en');
    await store.hydrateSettings();
    expect(store.getSettingsSnapshot().uiLang).toBe('en');
    // …and A's own switch persists separately.
    i18n.setUiLang('mn');
    await flushWrites();
    expect(h.scopes.get('user-a')?.uiLang).toBe('mn');

    // Switch to B: B starts from their own persisted record (none → default).
    activateAs(store, 'user-b');
    await store.hydrateSettings();
    expect(store.getSettingsSnapshot().uiLang).toBe('en');

    // Logout back to guest: the Mongolian UI comes back untouched.
    activateAs(store, null);
    await store.hydrateSettings();
    expect(store.getSettingsSnapshot().uiLang).toBe('mn');
    expect(h.scopes.get('user-a')?.uiLang).toBe('mn');
    expect(h.scopes.get('user-b')?.uiLang).toBeUndefined();
    ({ store, i18n } = { store, i18n });
  });

  it('restores the persisted locale after an app reload ("session 2")', async () => {
    let { store, i18n } = await freshModules();
    activateAs(store, 'user-a');
    await store.hydrateSettings();
    i18n.setUiLang('mn');
    await flushWrites();

    // Fresh module graph, same storage — like reopening the PWA.
    ({ store, i18n } = await freshModules());
    activateAs(store, 'user-a');
    await store.hydrateSettings();
    expect(i18n.currentUiLang()).toBe('mn');
    expect(i18n.t('common.save')).toBe('Хадгалах');
  });

  it('falls back to English for legacy records without a uiLang field', async () => {
    const { store, i18n } = await freshModules();
    activateAs(store, 'user-a');
    h.scopes.set('user-a', { ...DEFAULT_SETTINGS, uiLang: 'fr' as never });
    await store.hydrateSettings();
    expect(i18n.currentUiLang()).toBe('en');
  });
});
