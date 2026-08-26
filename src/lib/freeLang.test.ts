import { describe, expect, it } from 'vitest';
import { langLimitKey } from '@/lib/planGate';
import {
  FREE_LANG_OPTIONS,
  hideAllExcept,
  resolveFreeLanguage,
  seedCodeForLangKey,
  SUPPORTED_LANGUAGE_COUNT,
} from '@/lib/freeLang';
import { seedSetForLang } from '@/lib/seedSets';
import { LANGUAGES } from '@/lib/languages';
import { PLANS } from '@/lib/plans';
import vocabManifest from '../../public/data/vocab/manifest.json';
import type { VocabSet } from '@/types/app';

/** Minimal set stub — only `lang` matters here. */
function setOf(lang: string): VocabSet {
  return {
    id: `t-${lang}`,
    name: lang,
    lang,
    nativeLang: 'en-US',
    words: [],
    createdAt: 0,
    updatedAt: 0,
  };
}

describe('FREE_LANG_OPTIONS', () => {
  it('includes Spanish and Mongolian (a non-Spanish, full-pack language)', () => {
    const keys = FREE_LANG_OPTIONS.map((o) => o.key);
    expect(keys).toContain('es');
    expect(keys).toContain('mn');
  });

  it('offers only languages with seedable content', () => {
    for (const o of FREE_LANG_OPTIONS) {
      expect(seedSetForLang(o.key), `seed for ${o.key}`).not.toBeNull();
    }
  });

  it('uses normalized pack-level keys (langLimitKey convention)', () => {
    for (const o of FREE_LANG_OPTIONS) {
      expect(o.key, `key ${o.key}`).toBe(langLimitKey(o.code));
    }
  });

  it('has unique keys and non-empty friendly labels', () => {
    const keys = new Set(FREE_LANG_OPTIONS.map((o) => o.key));
    expect(keys.size).toBe(FREE_LANG_OPTIONS.length);
    for (const o of FREE_LANG_OPTIONS) {
      expect(o.label.trim().length).toBeGreaterThan(0);
    }
  });

  it('exposes exactly the 30 unique supported languages', () => {
    // The product historically ships 29 seedable languages (13 full-pack
    // STARTER_LANGS + 16 curated-only seeds). STARTER_LANGS all have seeds, so
    // the picker dedupes to the same 29 — an extra regional entry or a seed
    // without a pack label would surface here as a duplicate option.
    const keys = FREE_LANG_OPTIONS.map((o) => o.key);
    expect(keys.length).toBe(30);
    expect(new Set(keys).size).toBe(30);
  });

  it('is the count the dashboard dock must display — not the raw TTS catalog', () => {
    // Regression: the signed-in dashboard header previously rendered
    // `LANGUAGES.length`, the BCP-47 TTS catalog of every official language
    // plus regional variants (~254 entries, e.g. two dozen Arabic dialects).
    // The user-facing supported-language count is FREE_LANG_OPTIONS (30).
    expect(FREE_LANG_OPTIONS.length).toBe(30);
    expect(LANGUAGES.length).toBeGreaterThan(FREE_LANG_OPTIONS.length);
    // Every supported option still resolves to a real catalog entry for its
    // friendly label (mirrors findLanguage: exact code, else base tag) — the
    // two sources stay linked, not disjoint.
    for (const o of FREE_LANG_OPTIONS) {
      const base = o.code.split('-')[0];
      expect(
        LANGUAGES.some(
          (l) => l.code.toLowerCase() === o.code.toLowerCase() || l.code.toLowerCase() === base,
        ),
        `label source for ${o.code}`,
      ).toBe(true);
    }
  });
});

describe('SUPPORTED_LANGUAGE_COUNT — canonical customer-facing count', () => {
  it('is exactly the FREE_LANG_OPTIONS product set (30)', () => {
    expect(SUPPORTED_LANGUAGE_COUNT).toBe(FREE_LANG_OPTIONS.length);
    expect(SUPPORTED_LANGUAGE_COUNT).toBe(30);
  });

  it('is never the raw BCP-47 TTS voice catalog size', () => {
    // Regression: the dock once rendered LANGUAGES.length (~254 entries
    // incl. regional variants). The voice catalog is a TTS source, not a
    // product count — it must always be strictly larger.
    expect(LANGUAGES.length).toBeGreaterThan(SUPPORTED_LANGUAGE_COUNT);
    expect(LANGUAGES.length).not.toBe(SUPPORTED_LANGUAGE_COUNT);
  });

  it('is not the word-bank manifest size (13 full-pack languages)', () => {
    // The manifest only advertises languages with full A1–C2 packs; the app
    // can seed content for all 29. Marketing copy must show the product
    // count, not the smaller bank subset.
    const bankLangs = Object.keys(vocabManifest);
    expect(bankLangs.length).toBeLessThan(SUPPORTED_LANGUAGE_COUNT);
    expect(bankLangs.length).toBe(13);
    // ...but every full-pack language is a supported product language.
    for (const lang of bankLangs) {
      expect(
        FREE_LANG_OPTIONS.some((o) => o.key === lang),
        `full-pack language ${lang} must be supported`,
      ).toBe(true);
    }
  });

  it('is the count the Pro plan advertises on the landing page', () => {
    const proFeatures = PLANS.pro.features(SUPPORTED_LANGUAGE_COUNT);
    expect(proFeatures).toContain(`All ${SUPPORTED_LANGUAGE_COUNT} languages`);
  });
});

describe('resolveFreeLanguage — legacy migration', () => {
  it('honors an explicit selection, normalized', () => {
    expect(resolveFreeLanguage([setOf('es-ES')], [], 'es-ES')).toEqual({ key: 'es', hide: [] });
    expect(resolveFreeLanguage([setOf('es-ES')], [], 'fr-FR')).toEqual({ key: 'fr', hide: [] });
  });

  it('returns null when the user owns no visible sets (picker decides)', () => {
    expect(resolveFreeLanguage([], [], null)).toEqual({ key: null, hide: [] });
    expect(resolveFreeLanguage([], ['es'], null)).toEqual({ key: null, hide: [] });
  });

  it('infers the single visible language for a legacy user', () => {
    expect(resolveFreeLanguage([setOf('fr-FR')], [], null)).toEqual({ key: 'fr', hide: [] });
    expect(resolveFreeLanguage([setOf('mn')], [], null)).toEqual({ key: 'mn', hide: [] });
  });

  it('keeps a downgraded kept-language unambiguous by excluding hidden langs', () => {
    // Downgraded user: French hidden, Spanish visible → Spanish is inferred.
    const res = resolveFreeLanguage([setOf('es-ES'), setOf('fr-FR')], ['fr'], null);
    expect(res).toEqual({ key: 'es', hide: [] });
  });

  it('preserves ambiguous multi-language legacy users (no implicit hiding)', () => {
    expect(resolveFreeLanguage([setOf('es-ES'), setOf('fr-FR')], [], null)).toEqual({
      key: null,
      hide: [],
    });
  });

  it('never hides anything during inference', () => {
    for (const res of [
      resolveFreeLanguage([setOf('es-ES')], [], null),
      resolveFreeLanguage([setOf('fr-FR')], [], null),
      resolveFreeLanguage([setOf('es-ES'), setOf('fr-FR')], [], null),
    ]) {
      expect(res.hide).toEqual([]);
    }
  });
});

describe('hideAllExcept — language change without data loss', () => {
  const owned = [setOf('es-ES'), setOf('fr-FR'), setOf('mn')];

  it('hides every other owned language when switching', () => {
    expect(hideAllExcept(owned, 'es')).toEqual(['fr', 'mn']);
    expect(hideAllExcept(owned, 'mn')).toEqual(['es', 'fr']);
  });

  it('normalizes the kept key across BCP-47 and bare codes', () => {
    expect(hideAllExcept(owned, 'es-ES')).toEqual(['fr', 'mn']);
  });

  it('hides nothing when only the kept language is owned', () => {
    expect(hideAllExcept([setOf('es-ES')], 'es')).toEqual([]);
  });

  it('never lists the kept language itself', () => {
    const hide = hideAllExcept(owned, 'fr');
    expect(hide).not.toContain('fr');
  });
});

describe('seedCodeForLangKey / seedSetForLang', () => {
  it('maps a normalized key back to a seedable language', () => {
    expect(seedCodeForLangKey('es')).toBe('es-ES');
    expect(seedCodeForLangKey('mn')).toBe('mn');
  });

  it('finds the exact starter seed set for a chosen language', () => {
    expect(seedSetForLang('es')?.id).toBe('seed-spanish-essentials');
    expect(seedSetForLang('mn')?.id).toBe('seed-mongolian-basics');
  });

  it('returns null for unsupported languages', () => {
    expect(seedSetForLang('xx')).toBeNull();
  });
});
