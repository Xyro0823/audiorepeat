import { PACK_LANG } from '@/lib/starterSets';
import type { VocabSet } from '@/types/app';

/**
 * Shared Free-plan language-limit gate — the single normalization + rule set
 * used by the editor, Browse library, topic packs and (via useLists) every
 * surface that renders sets. Do NOT build a second gating system.
 *
 * The rule mirrors StarterLibraryModal.canAddLang exactly:
 *   - Pro/Lifetime (pro = true) → any language.
 *   - Free → only languages the user already has VISIBLE sets in
 *     (settings.hiddenLangs already filters visibility), i.e. the single
 *     active language. Creating NEW content in any other language is blocked.
 */

/** Fallback "allowed" language when a Free user owns no visible sets at all
 *  (e.g. they deleted their last set). Matches the seed system's first
 *  language and the editor's default, so a Free user is never fully locked
 *  out — but still limited to exactly one language. */
export const DEFAULT_ALLOWED_LANG = 'es-ES';

/** Normalize a BCP-47 tag (e.g. "es-ES") or pack code ("es") to the shared
 *  pack-level key so the same language is recognized consistently across
 *  seed sets, topic packs, the editor and the dashboard. */
export function langLimitKey(code: string): string {
  return PACK_LANG[code] ?? code;
}

/** Normalized pack-level keys for the languages the user currently has
 *  visible sets in (empty when pro — everything is allowed). */
export function visibleLangKeys(sets: VocabSet[]): Set<string> {
  const keys = new Set<string>();
  for (const s of sets) keys.add(langLimitKey(s.lang));
  return keys;
}

/** True when the user may create/edit sets in `code` under the current plan. */
export function canUseLang(pro: boolean, sets: VocabSet[], code: string): boolean {
  if (pro) return true;
  const key = langLimitKey(code);
  const owned = visibleLangKeys(sets);
  if (owned.size === 0) return key === langLimitKey(DEFAULT_ALLOWED_LANG);
  return owned.has(key);
}
