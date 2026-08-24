/**
 * UI localization — the language the INTERFACE speaks.
 *
 * This is deliberately separate from the learning-language system
 * (lib/languages.ts, freeLang.ts): those pick which language the USER
 * LEARNS; this picks which language buttons/labels/errors render in.
 * English is always available and is the default/fallback locale.
 */
export type UiLang = 'en' | 'mn';

export const DEFAULT_UI_LANG: UiLang = 'en';

export const UI_LANGUAGES: ReadonlyArray<{ code: UiLang; label: string }> = [
  { code: 'en', label: 'English' },
  { code: 'mn', label: 'Монгол' },
];

export function isUiLang(value: unknown): value is UiLang {
  return value === 'en' || value === 'mn';
}
