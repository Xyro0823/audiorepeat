import { useCallback, useSyncExternalStore } from 'react';
import { dictionaries, type TKey } from './dictionaries';
import { DEFAULT_UI_LANG, isUiLang, UI_LANGUAGES, type UiLang } from './types';
import { getSettingsSnapshot, subscribeSettings, updateSettings } from '@/lib/settingsStore';

/**
 * Translation core. Pure functions live here so non-React modules (auth
 * errors, service-worker copy) can localize too; the `useT` hook binds a
 * component to the current locale reactively via the settings store.
 *
 * SSR/hydration: the store's snapshot starts at defaults (English) on both
 * server and first client render; the persisted locale arrives after
 * hydration and re-renders — same pattern as ThemeManager.
 */

export { DEFAULT_UI_LANG, isUiLang, UI_LANGUAGES };
export type { TKey, UiLang };

export type TVars = Record<string, string | number>;

/** Replace {name} placeholders. Unknown placeholders are left intact. */
function interpolate(template: string, vars: TVars | undefined): string {
  if (!vars) return template;
  let out = template;
  for (const [name, value] of Object.entries(vars)) {
    out = out.replaceAll(`{${name}}`, String(value));
  }
  return out;
}

/** Translate for an explicit locale (pure, SSR-safe). */
export function translate(lang: UiLang, key: TKey, vars?: TVars): string {
  const table = dictionaries[lang] ?? dictionaries[DEFAULT_UI_LANG];
  const template = table[key] ?? dictionaries[DEFAULT_UI_LANG][key] ?? String(key);
  return interpolate(template, vars);
}

/** Current UI locale from the settings snapshot (works outside React). */
export function currentUiLang(): UiLang {
  const stored = getSettingsSnapshot().uiLang;
  return isUiLang(stored) ? stored : DEFAULT_UI_LANG;
}

/** Translate using the CURRENT settings snapshot (non-React call sites). */
export function t(key: TKey, vars?: TVars): string {
  return translate(currentUiLang(), key, vars);
}

/** Switch the interface language. Persists with the active account scope. */
export function setUiLang(lang: UiLang): void {
  updateSettings({ uiLang: lang });
}

/** Stable per-call identity so consumers can memo effects on it if needed. */
export type TFn = (key: TKey, vars?: TVars) => string;

/** Reactive translator bound to the persisted, account-scoped locale. */
export function useT(): TFn {
  const lang = useSyncExternalStore(
    subscribeSettings,
    () => {
      const stored = getSettingsSnapshot().uiLang;
      return isUiLang(stored) ? stored : DEFAULT_UI_LANG;
    },
    () => DEFAULT_UI_LANG,
  );
  return useCallback<TFn>((key, vars) => translate(lang, key, vars), [lang]);
}
