import { seedCodeForLangKey } from '@/lib/freeLang';

/**
 * Resolve the default language for a new SetEditor.
 *
 * - Pro/Lifetime: returns the user's preferred BCP-47 code from
 *   `settings.defaultNewSetLang` directly, or `undefined` if unset.
 * - Free: derives a BCP-47 code from the Free-plan selected language key
 *   via `seedCodeForLangKey`, or `undefined` if unavailable.
 * - Neither set: `undefined`.
 *
 * This is the single source of truth for the SetEditor's `defaultLang` prop;
 * SetLibrary calls it instead of inlining the conditional.
 */
export function resolveDefaultNewSetLang(
  pro: boolean,
  defaultNewSetLang: string | null | undefined,
  freeLangKey: string | null | undefined,
): string | undefined {
  if (pro) return defaultNewSetLang ?? undefined;
  return (freeLangKey ? (seedCodeForLangKey(freeLangKey) ?? undefined) : undefined);
}
