import { currentUiLang, setUiLang } from './index';
import { hasExplicitUiLangChoice } from './choice';
import type { UiLang } from './types';

/**
 * First-visit browser-locale detection.
 *
 * Rules:
 *  - English is the global default; nothing here ever removes it.
 *  - Only when the browser language starts with "mn" AND the user has never
 *    expressed a UI-language choice do we initially switch to Монгол.
 *  - An explicit choice ALWAYS wins: every user-driven language change (the
 *    Settings selector and the public EN/МН toggle go through setUiLang)
 *    persists uiLang into the active account/guest scope AND writes a
 *    device-global sentinel. Once the sentinel exists, auto-detection never
 *    runs again on this device — no repeated auto-switching.
 *
 * SSR/hydration safety: this runs strictly in a post-mount effect and only
 * then mutates the settings store, so server HTML and first client paint
 * agree on English; Монгол arrives as an ordinary state update afterwards.
 */

const SESSION_FLAG = 'audiorepeat-uilang-detect-v1';

/** The browser's preferred UI locale for this app ('en' unless Mongolian). */
export function browserUiLang(): UiLang | null {
  if (typeof navigator === 'undefined') return null;
  const lang = navigator.language?.toLowerCase?.() ?? '';
  return lang.startsWith('mn') ? 'mn' : null;
}

/**
 * Apply browser detection once per session. Safe to call from any mounted
 * component; concurrent/duplicate calls collapse on the session flag.
 */
export async function autoDetectUiLang(): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    if (window.sessionStorage.getItem(SESSION_FLAG)) return;
    window.sessionStorage.setItem(SESSION_FLAG, '1');
  } catch {
    /* private mode — still run once per page load */
  }
  if (hasExplicitUiLangChoice()) return;
  if (browserUiLang() !== 'mn') return;

  // A persisted record that already carries a uiLang field means the choice
  // was made deliberately (legacy records predate the field). Await settings
  // hydration first so stored truth is read instead of being raced.
  try {
    const { hydrateSettings } = await import('@/lib/settingsStore');
    const { getSettings } = await import('@/lib/db/indexedDb');
    await hydrateSettings();
    const stored = (await getSettings().catch(() => undefined)) as
      | { uiLang?: unknown }
      | undefined;
    if (stored && 'uiLang' in stored && typeof stored.uiLang === 'string') return;
  } catch {
    /* no IndexedDB — treat as a genuinely fresh visitor */
  }

  // Fresh Mongolian-browser visitor: start in Монгол WITHOUT persisting it as
  // a user choice — the moment they pick a language explicitly, that choice
  // takes over permanently.
  if (currentUiLang() !== 'mn') setUiLang('mn', { detected: true });
}
