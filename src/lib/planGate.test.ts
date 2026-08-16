import { describe, expect, it } from 'vitest';
import { DEFAULT_ALLOWED_LANG, canUseLang, langLimitKey, visibleLangKeys } from '@/lib/planGate';
import type { VocabSet } from '@/types/app';

/** Minimal set stub — only `lang` matters for the gate. */
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

describe('langLimitKey', () => {
  it('maps a BCP-47 tag with a region to its Spanish pack key', () => {
    expect(langLimitKey('es-ES')).toBe('es');
  });

  it('keeps the bare pack code as the same normalized key', () => {
    expect(langLimitKey('es')).toBe('es');
  });

  it('normalizes other known pack languages consistently', () => {
    expect(langLimitKey('fr-FR')).toBe('fr');
    expect(langLimitKey('ja-JP')).toBe('ja');
    expect(langLimitKey('pt-BR')).toBe('pt');
    expect(langLimitKey('it')).toBe('it');
  });

  it('falls back to the original code for unknown/custom codes', () => {
    expect(langLimitKey('zz-ZZ')).toBe('zz-ZZ');
    expect(langLimitKey('en-US')).toBe('en-US');
    expect(langLimitKey('made-up')).toBe('made-up');
  });

  it('normalizes the default allowed language to the Spanish pack key', () => {
    expect(langLimitKey(DEFAULT_ALLOWED_LANG)).toBe('es');
  });
});

describe('visibleLangKeys', () => {
  it('collapses multiple sets in the same language to one key', () => {
    expect(visibleLangKeys([setOf('es-ES'), setOf('es'), setOf('es-ES')])).toEqual(new Set(['es']));
  });

  it('keeps an unmapped regional variant distinct (only es-ES maps to es)', () => {
    // PACK_LANG maps es-ES -> es; es-MX has no entry, so it stays its own key.
    expect(visibleLangKeys([setOf('es-ES'), setOf('es-MX')])).toEqual(new Set(['es', 'es-MX']));
  });

  it('resolves BCP-47 variants to the same normalized key', () => {
    expect(visibleLangKeys([setOf('es-ES'), setOf('es')])).toEqual(new Set(['es']));
  });

  it('keeps distinct languages distinct', () => {
    expect(visibleLangKeys([setOf('es-ES'), setOf('fr-FR'), setOf('ja-JP')])).toEqual(
      new Set(['es', 'fr', 'ja']),
    );
  });

  it('returns an empty set for an empty list', () => {
    expect(visibleLangKeys([])).toEqual(new Set());
  });
});

describe('canUseLang — Pro/Lifetime', () => {
  it('allows any language', () => {
    expect(canUseLang(true, [setOf('es-ES')], 'fr-FR')).toBe(true);
    expect(canUseLang(true, [setOf('es-ES')], 'zh-CN')).toBe(true);
  });

  it('allows any language even with no visible sets', () => {
    expect(canUseLang(true, [], 'es-ES')).toBe(true);
    expect(canUseLang(true, [], 'fr-FR')).toBe(true);
    expect(canUseLang(true, [], 'unknown-xx')).toBe(true);
  });
});

describe('canUseLang — Free, one active language', () => {
  const spanish = [setOf('es-ES')];

  it('allows the owned language via its BCP-47 tag', () => {
    expect(canUseLang(false, spanish, 'es-ES')).toBe(true);
  });

  it('allows the equivalent bare pack code for the owned language', () => {
    expect(canUseLang(false, spanish, 'es')).toBe(true);
  });

  it('blocks a language that is not owned', () => {
    expect(canUseLang(false, spanish, 'fr-FR')).toBe(false);
    expect(canUseLang(false, spanish, 'de-DE')).toBe(false);
  });
});

describe('canUseLang — Free, multiple legacy languages', () => {
  const legacy = [setOf('es-ES'), setOf('fr-FR')];

  it('keeps every visible language allowed (legacy users are not stripped)', () => {
    expect(canUseLang(false, legacy, 'es-ES')).toBe(true);
    expect(canUseLang(false, legacy, 'es')).toBe(true);
    expect(canUseLang(false, legacy, 'fr-FR')).toBe(true);
    expect(canUseLang(false, legacy, 'fr')).toBe(true);
  });

  it('still blocks languages outside the visible set', () => {
    expect(canUseLang(false, legacy, 'ja-JP')).toBe(false);
  });
});

describe('canUseLang — Free, zero visible sets', () => {
  it('allows the default allowed language (es-ES / es)', () => {
    expect(canUseLang(false, [], 'es-ES')).toBe(true);
    expect(canUseLang(false, [], 'es')).toBe(true);
  });

  it('blocks everything else', () => {
    expect(canUseLang(false, [], 'fr-FR')).toBe(false);
    expect(canUseLang(false, [], 'de-DE')).toBe(false);
  });
});

describe('canUseLang — BCP-47 normalization', () => {
  it('a set stored as es-ES allows the equivalent normalized es code', () => {
    expect(canUseLang(false, [setOf('es-ES')], 'es')).toBe(true);
  });

  it('a French set does not accidentally allow Spanish', () => {
    expect(canUseLang(false, [setOf('fr-FR')], 'es-ES')).toBe(false);
    expect(canUseLang(false, [setOf('fr-FR')], 'es')).toBe(false);
  });

  it('a bare-pack-code set allows its BCP-47 tag', () => {
    expect(canUseLang(false, [setOf('fr')], 'fr-FR')).toBe(true);
  });
});

describe('canUseLang — explicit selectedFreeLang (post-onboarding Free)', () => {
  const mn = [setOf('mn')];

  it('allows exactly the selected language (normalized key)', () => {
    expect(canUseLang(false, mn, 'mn', 'mn')).toBe(true);
    expect(canUseLang(false, mn, 'mn', 'es')).toBe(false);
  });

  it('locks every other language for Free', () => {
    expect(canUseLang(false, mn, 'es-ES', 'mn')).toBe(false);
    expect(canUseLang(false, mn, 'es', 'mn')).toBe(false);
    expect(canUseLang(false, mn, 'fr-FR', 'mn')).toBe(false);
  });

  it('overrides the legacy visible-sets inference (exactly one language)', () => {
    // Even a legacy multi-language library is restricted once a choice exists.
    const legacy = [setOf('es-ES'), setOf('fr-FR')];
    expect(canUseLang(false, legacy, 'es-ES', 'es')).toBe(true);
    expect(canUseLang(false, legacy, 'fr-FR', 'es')).toBe(false);
  });

  it('a hidden previous language stays locked after a switch', () => {
    // User switched free language from es to mn: mn usable, es locked.
    const withHidden = [setOf('es-ES'), setOf('mn')];
    expect(canUseLang(false, withHidden, 'mn', 'mn')).toBe(true);
    expect(canUseLang(false, withHidden, 'es-ES', 'mn')).toBe(false);
  });

  it('Pro ignores the Free-language restriction entirely', () => {
    expect(canUseLang(true, [], 'es-ES', 'mn')).toBe(true);
    expect(canUseLang(true, mn, 'es', 'mn')).toBe(true);
    expect(canUseLang(true, mn, 'ja-JP', 'mn')).toBe(true);
  });

  it('Lifetime ignores the restriction too', () => {
    expect(canUseLang(true, [], 'es', 'mn')).toBe(true);
    expect(canUseLang(true, [], 'zh-CN', 'mn')).toBe(true);
  });

  it('downgrade back to Free restores the selected-language gating', () => {
    // After a Pro → Free downgrade the selection is remembered: mn only.
    expect(canUseLang(false, mn, 'mn', 'mn')).toBe(true);
    expect(canUseLang(false, mn, 'de-DE', 'mn')).toBe(false);
  });
});

describe('canUseLang — hidden-language (downgrade) scenario', () => {
  // A downgraded Free user's visible sets contain ONLY the kept language —
  // useLists already filters hiddenLangs before canUseLang is ever called, so
  // passing only the visible/kept language here is the correct simulation.
  const keptSpanish = [setOf('es-ES')];

  it('keeps the active/kept language usable', () => {
    expect(canUseLang(false, keptSpanish, 'es')).toBe(true);
  });

  it('treats a hidden language as not allowed', () => {
    expect(canUseLang(false, keptSpanish, 'fr-FR')).toBe(false);
    expect(canUseLang(false, keptSpanish, 'fr')).toBe(false);
  });

  it('a hidden language is not reintroduced by its bare pack code', () => {
    expect(canUseLang(false, [setOf('es-ES')], 'de')).toBe(false);
  });
});
