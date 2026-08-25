import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * First-visit browser-locale detection: only a fresh "mn*" browser without
 * any explicit choice switches to Монгол; the sentinel, a stored uiLang, or
 * a non-mn browser all leave English in place. The detected switch must NOT
 * count as an explicit user choice.
 */
const h = vi.hoisted(() => ({
  lang: 'en-US',
  localStorage: new Map<string, string>(),
  sessionStorage: new Map<string, string>(),
  stored: undefined as Record<string, unknown> | undefined,
  updateSettings: vi.fn(),
}));

vi.mock('@/lib/settingsStore', () => ({
  hydrateSettings: async () => {},
  getSettingsSnapshot: () => ({ uiLang: 'en' }),
  subscribeSettings: () => () => {},
  updateSettings: h.updateSettings,
}));

vi.mock('@/lib/db/indexedDb', () => ({
  getSettings: async () => h.stored,
}));

vi.stubGlobal('navigator', {
  get language() {
    return h.lang;
  },
});
vi.stubGlobal('window', {
  localStorage: {
    getItem: (k: string) => h.localStorage.get(k) ?? null,
    setItem: (k: string, v: string) => void h.localStorage.set(k, v),
  },
  sessionStorage: {
    getItem: (k: string) => h.sessionStorage.get(k) ?? null,
    setItem: (k: string, v: string) => void h.sessionStorage.set(k, v),
  },
});

async function fresh() {
  vi.resetModules();
  return import('./detect');
}

beforeEach(() => {
  h.lang = 'en-US';
  h.localStorage.clear();
  h.sessionStorage.clear();
  h.stored = undefined;
  h.updateSettings.mockReset();
});

describe('browserUiLang', () => {
  it('maps mn* browsers to Mongolian and everything else to English', async () => {
    const mod = await fresh();
    h.lang = 'mn-MN';
    expect(mod.browserUiLang()).toBe('mn');
    h.lang = 'mn';
    expect(mod.browserUiLang()).toBe('mn');
    h.lang = 'en-US';
    expect(mod.browserUiLang()).toBeNull();
    h.lang = 'de-DE';
    expect(mod.browserUiLang()).toBeNull();
  });
});

describe('autoDetectUiLang', () => {
  it('switches a fresh mn-browser visitor to Mongolon once', async () => {
    h.lang = 'mn-MN';
    const mod = await fresh();
    await mod.autoDetectUiLang();
    expect(h.updateSettings).toHaveBeenCalledWith({ uiLang: 'mn', });
    // The detected switch is NOT an explicit user choice…
    expect(h.localStorage.has('audiorepeat-uilang-chosen-v1')).toBe(false);
    // …and the session flag prevents repeat runs.
    await mod.autoDetectUiLang();
    expect(h.updateSettings).toHaveBeenCalledTimes(1);
  });

  it('never touches English-default or explicitly chosen browsers', async () => {
    const mod = await fresh();
    await mod.autoDetectUiLang();
    expect(h.updateSettings).not.toHaveBeenCalled();

    h.lang = 'mn-MN';
    h.localStorage.set('audiorepeat-uilang-chosen-v1', '123');
    await mod.autoDetectUiLang();
    expect(h.updateSettings).not.toHaveBeenCalled();
  });

  it('respects a stored uiLang record (explicit prior choice)', async () => {
    h.lang = 'mn-MN';
    h.stored = { uiLang: 'en' };
    const mod = await fresh();
    await mod.autoDetectUiLang();
    expect(h.updateSettings).not.toHaveBeenCalled();
  });

  it('still detects for legacy records without a uiLang field', async () => {
    h.lang = 'mn-MN';
    h.stored = { theme: 'dark' };
    const mod = await fresh();
    await mod.autoDetectUiLang();
    expect(h.updateSettings).toHaveBeenCalledWith({ uiLang: 'mn', });
  });

  it('marks real user choices via setUiLang so detection never re-runs', async () => {
    h.lang = 'mn-MN';
    const i18n = await import('./index');
    i18n.setUiLang('en');
    expect(h.localStorage.has('audiorepeat-uilang-chosen-v1')).toBe(true);
    h.updateSettings.mockClear();
    const mod = await fresh();
    await mod.autoDetectUiLang();
    expect(h.updateSettings).not.toHaveBeenCalled();
  });
});
