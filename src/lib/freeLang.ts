import type { VocabSet } from '@/types/app';
import { findLanguage } from '@/lib/languages';
import { langLimitKey } from '@/lib/planGate';
import { hydrateSeedWords, seedSetForLang, SEED_SETS } from '@/lib/seedSets';
import { PACK_LANG, STARTER_LANGS } from '@/lib/starterSets';

/**
 * Free-plan language selection + migration helpers (pure, unit-tested).
 *
 * The Free plan includes exactly ONE language. New users pick it during
 * onboarding; existing users are migrated with a deterministic, non-destructive
 * rule. Everything here is decision logic — the single enforcement point stays
 * planGate.canUseLang, and the UI merely maps these results to markup.
 */

export interface FreeLangOption {
  /** Normalized pack-level key (langLimitKey convention), e.g. "es", "mn". */
  key: string;
  /** A representative BCP-47 tag for labels/flags, e.g. "es-ES". */
  code: string;
  /** Friendly display label, e.g. "Spanish (Spain)". */
  label: string;
  /** True when a full A1-C2 word pack ships for this language. */
  hasFullPack: boolean;
}

/**
 * Every language the app can actually seed content for (starter sets, with
 * full CEFR word packs where they exist). Ordered: languages with full packs
 * first (STARTER_LANGS order), then the remaining seed-set languages. Only
 * these are offered in the picker — a Free user's included language must have
 * real content to seed.
 */
export const FREE_LANG_OPTIONS: readonly FreeLangOption[] = (() => {
  const seen = new Set<string>();
  const options: FreeLangOption[] = [];
  const push = (code: string, hasFullPack: boolean) => {
    // Exactly langLimitKey's normalization (case-sensitive lookup; bare codes
    // and mapped tags fall back to the raw code) so a chosen key always
    // matches planGate comparisons — e.g. the Norwegian seed's 'nb-NO'.
    const key = PACK_LANG[code] ?? code;
    if (seen.has(key)) return;
    seen.add(key);
    options.push({
      key,
      code,
      label: findLanguage(code)?.label ?? code,
      hasFullPack,
    });
  };
  for (const code of STARTER_LANGS) push(code, true);
  for (const s of SEED_SETS) push(s.lang, false);
  return options;
})();

/**
 * Canonical user-facing "supported languages" count. Use this — and only
 * this — wherever customer-facing copy states how many languages the product
 * supports:
 *
 *   - NOT LANGUAGES.length (src/lib/languages.ts): that is the BCP-47 TTS
 *     voice-matching catalog (~254 entries incl. regional variants like two
 *     dozen Arabic dialects) and must stay a voice source, not a product
 *     count.
 *   - NOT the word-bank manifest size: only 13 languages ship full A1–C2
 *     packs, while the app can seed content for all 29 supported languages.
 */
export const SUPPORTED_LANGUAGE_COUNT = FREE_LANG_OPTIONS.length;

export interface FreeLangResolution {
  /** The language to record as selected, or null to keep legacy behavior. */
  key: string | null;
  /** Other owned languages to hide (never delete) once a selection exists. */
  hide: string[];
}

/**
 * Deterministic migration for a Free user with no explicit selection yet:
 *
 *   1. An explicit `selected` is honored as-is (normalized).
 *   2. No visible sets → null (legacy fallback in canUseLang keeps the user
 *      from being locked out; the picker lets them choose).
 *   3. Exactly ONE visible language → that language (nothing hidden).
 *   4. Multiple visible languages (legacy multi-language Free user) → null:
 *      preserve the current legacy behavior — every visible language stays
 *      usable until the user explicitly changes their free language. Nothing
 *      is ever hidden or deleted implicitly for ambiguous legacy accounts.
 *
 * `hiddenLangs` (already-normalized keys) are excluded from the visible count,
 * so a prior downgrade's kept language is correctly inferred.
 */
export function resolveFreeLanguage(
  sets: VocabSet[],
  hiddenLangs: string[],
  selected: string | null | undefined,
): FreeLangResolution {
  if (selected) return { key: langLimitKey(selected), hide: [] };
  const hidden = new Set(hiddenLangs.map(langLimitKey));
  const visible = new Set<string>();
  for (const s of sets) {
    const key = langLimitKey(s.lang);
    if (!hidden.has(key)) visible.add(key);
  }
  if (visible.size === 0) return { key: null, hide: [] };
  if (visible.size === 1) {
    const key = [...visible][0];
    return { key, hide: [] };
  }
  // Ambiguous legacy account — keep current behavior (no implicit hiding).
  return { key: null, hide: [] };
}

/**
 * Languages to hide when a Free user explicitly switches their included
 * language to `keepKey`: every OTHER owned language is hidden (never deleted).
 * Returning an empty array when only the kept language is owned.
 */
export function hideAllExcept(sets: VocabSet[], keepKey: string): string[] {
  const keep = langLimitKey(keepKey);
  const owned = new Set(sets.map((s) => langLimitKey(s.lang)));
  owned.delete(keep);
  return [...owned];
}

/** A representative BCP-47 tag for a normalized pack key (for labels/flags). */
export function seedCodeForLangKey(langKey: string): string | null {
  return seedSetForLang(langKey)?.lang ?? null;
}

/**
 * The hydrated starter set for a chosen Free language (full A1 word pack when
 * the language ships one, curated words as an offline fallback), or null when
 * the language has no seed content. Callers write it through the normal
 * saveSet path so the dashboard state updates immediately.
 */
export async function buildSeedSetForLang(langKey: string): Promise<VocabSet | null> {
  const seed = seedSetForLang(langKey);
  if (!seed) return null;
  const h = await hydrateSeedWords(seed);
  const now = Date.now();
  return {
    ...seed,
    words: h.words,
    createdAt: now,
    updatedAt: now,
  };
}
