import { PACK_LANG } from '@/lib/starterSets';
import type { VocabSet } from '@/types/app';

/**
 * Shared Free-plan language-limit gate — the single normalization + rule set
 * used by the editor, Browse library, topic packs and (via useLists) every
 * surface that renders sets. Do NOT build a second gating system.
 *
 * The rule:
 *   - Pro/Lifetime (pro = true) → any language.
 *   - Free with an explicit selected language (settings.selectedFreeLang,
 *     normalized pack key) → exactly that one language; everything else is
 *     Pro-locked. This is the post-onboarding behavior.
 *   - Free with NO selection yet (legacy users) → the historical rule: only
 *     languages the user already has VISIBLE sets in (settings.hiddenLangs
 *     already filters visibility). A user with no visible sets at all falls
 *     back to DEFAULT_ALLOWED_LANG so they are never fully locked out.
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

/**
 * True when the user may create/edit sets in `code` under the current plan.
 * `selectedFreeLang` is the user's explicit Free-language choice (normalized
 * pack key, from settings.selectedFreeLang) — when present it overrides the
 * legacy visible-sets inference so the Free plan is exactly one language.
 */
export function canUseLang(
  pro: boolean,
  sets: VocabSet[],
  code: string,
  selectedFreeLang?: string | null,
): boolean {
  if (pro) return true;
  const key = langLimitKey(code);
  if (selectedFreeLang) return key === langLimitKey(selectedFreeLang);
  const owned = visibleLangKeys(sets);
  if (owned.size === 0) return key === langLimitKey(DEFAULT_ALLOWED_LANG);
  return owned.has(key);
}
