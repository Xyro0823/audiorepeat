import { describe, expect, it } from 'vitest';
import { langLimitKey } from '@/lib/planGate';
import {
  FREE_LANG_OPTIONS,
  hideAllExcept,
  resolveFreeLanguage,
  seedCodeForLangKey,
} from '@/lib/freeLang';
import { seedSetForLang } from '@/lib/seedSets';
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

  it('exposes exactly the 29 unique supported languages (no phantom 30th option)', () => {
    // The product historically ships 29 seedable languages (13 full-pack
    // STARTER_LANGS + 16 curated-only seeds). STARTER_LANGS all have seeds, so
    // the picker dedupes to the same 29 — an extra regional entry or a seed
    // without a pack label would surface here as a 30th option.
    const keys = FREE_LANG_OPTIONS.map((o) => o.key);
    expect(keys.length).toBe(29);
    expect(new Set(keys).size).toBe(29);
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
