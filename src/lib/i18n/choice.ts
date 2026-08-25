/**
 * Device-global record of an explicit UI-language choice.
 *
 * The per-account/guest preference itself lives in the settings store
 * (uiLang). This sentinel adds one bit on top: "a human picked a language
 * on this device at some point", so first-visit browser detection can never
 * auto-switch again — even for a different account whose stored record
 * predates the uiLang field.
 */
const CHOICE_FLAG = 'audiorepeat-uilang-chosen-v1';

/** True when the visitor has explicitly picked a UI language on this device. */
export function hasExplicitUiLangChoice(): boolean {
  try {
    return window.localStorage.getItem(CHOICE_FLAG) !== null;
  } catch {
    return false;
  }
}

/** Record an explicit UI-language choice (called by setUiLang). */
export function markExplicitUiLangChoice(): void {
  try {
    window.localStorage.setItem(CHOICE_FLAG, String(Date.now()));
  } catch {
    /* storage unavailable — detection may re-run, which is harmless */
  }
}
