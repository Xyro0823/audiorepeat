import { describe, it, expect } from 'vitest';
import { pickVoiceForLang, resolvePersistedVoice } from './speechSynthesisEngine';
import type { TTSEngineVoice } from './engine';
import { FREE_LANG_OPTIONS, SUPPORTED_LANGUAGE_COUNT } from '@/lib/freeLang';

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function voice(lang: string, name = 'Test', local = false): TTSEngineVoice {
  return { name, lang, localService: local, uri: `${name}-${lang}`, isDefault: false };
}

/* ------------------------------------------------------------------ */
/*  Core resolver — must return the correct voice, not just "any"      */
/* ------------------------------------------------------------------ */

describe('pickVoiceForLang', () => {
  /* --- exact BCP-47 match --- */

  it('picks an exact BCP-47 match', () => {
    const voices = [voice('es-ES'), voice('es-MX')];
    const result = pickVoiceForLang(voices, 'es-ES');
    expect(result).toBe(voices[0]);
    expect(result?.lang).toBe('es-ES');
  });

  it('case-normalises the target', () => {
    const voices = [voice('ES-ES')];
    expect(pickVoiceForLang(voices, 'es-ES')).toBe(voices[0]);
  });

  it('case-normalises the voice list', () => {
    const voices = [voice('ES-ES')];
    expect(pickVoiceForLang(voices, 'ES-ES')).toBe(voices[0]);
  });

  /* --- same-base-language (exact base-subtag, NOT prefix) --- */

  it('falls back to any same-base-language voice (es-ES → es-MX)', () => {
    const voices = [voice('es-MX')];
    const result = pickVoiceForLang(voices, 'es-ES');
    expect(result).toBe(voices[0]);
    expect(result?.lang).toBe('es-MX');
  });

  it('falls back to same base-subtag for bare codes (es → es-ES)', () => {
    const voices = [voice('es-ES')];
    const result = pickVoiceForLang(voices, 'es');
    expect(result).toBe(voices[0]);
  });

  /* --- fi/fil CROSS-MATCH REGRESSION --- */

  it('does NOT cross-match fi (Finnish) with fil (Filipino) voices', () => {
    // target fi should NOT match a fil-PH voice
    const filVoices = [voice('fil-PH')];
    expect(pickVoiceForLang(filVoices, 'fi')).toBeUndefined();
  });

  it('does NOT cross-match fil (Filipino) with fi (Finnish) voices', () => {
    // target fil should NOT match a fi-FI voice
    const fiVoices = [voice('fi-FI')];
    expect(pickVoiceForLang(fiVoices, 'fil')).toBeUndefined();
  });

  it('matches fi to fi-FI but not fil-PH', () => {
    const voices = [voice('fil-PH'), voice('fi-FI')];
    const result = pickVoiceForLang(voices, 'fi');
    expect(result).toBe(voices[1]); // fi-FI, not fil-PH
    expect(result?.lang).toBe('fi-FI');
  });

  it('matches fil to fil-PH but not fi-FI', () => {
    const voices = [voice('fi-FI'), voice('fil-PH')];
    const result = pickVoiceForLang(voices, 'fil');
    expect(result).toBe(voices[1]); // fil-PH, not fi-FI
    expect(result?.lang).toBe('fil-PH');
  });

  /* --- offline preference --- */

  it('prefers offline voice when both match the same language', () => {
    const online = voice('en-US', 'Online');
    const offline = voice('en-US', 'Offline', true);
    const result = pickVoiceForLang([online, offline], 'en-US');
    expect(result).toBe(offline);
    expect(result?.localService).toBe(true);
  });

  /* --- LOCAL VOICE POOL BUG FIX --- */

  it('does NOT skip online voices when local voices exist but do not match', () => {
    const localFr = voice('fr-FR', 'LocalFrench', true);
    const onlineEn = voice('en-US', 'OnlineEnglish');
    const result = pickVoiceForLang([localFr, onlineEn], 'en-US');
    expect(result).toBe(onlineEn);
    expect(result?.lang).toBe('en-US');
  });

  it('prefers matching local over matching online (different languages)', () => {
    const localEs = voice('es-ES', 'LocalSpanish', true);
    const onlineEn = voice('en-US', 'OnlineEnglish');
    const result = pickVoiceForLang([localEs, onlineEn], 'es-ES');
    expect(result).toBe(localEs);
  });

  /* --- known-safe locale fallback --- */

  it('uses known-safe locale fallback for Mongolian (mn → mn-MN)', () => {
    const voices = [voice('mn-MN')];
    const result = pickVoiceForLang(voices, 'mn');
    expect(result).toBe(voices[0]);
    expect(result?.lang).toBe('mn-MN');
  });

  it('uses known-safe locale fallback for Norwegian Bokmål (nb-NO → no-NO)', () => {
    const voices = [voice('no-NO')];
    const result = pickVoiceForLang(voices, 'nb-NO');
    expect(result).toBe(voices[0]);
    expect(result?.lang).toBe('no-NO');
  });

  it('Norwegian fallback works with uppercase input (NB-NO → no-NO)', () => {
    const voices = [voice('no-NO')];
    const result = pickVoiceForLang(voices, 'NB-NO');
    expect(result).toBe(voices[0]);
    expect(result?.lang).toBe('no-NO');
  });

  it('Norwegian fallback works with mixed-case input (Nb-No → no-NO)', () => {
    const voices = [voice('no-NO')];
    const result = pickVoiceForLang(voices, 'Nb-No');
    expect(result).toBe(voices[0]);
  });

  it('locale fallback respects local-first preference', () => {
    const localNo = voice('no-NO', 'LocalNorwegian', true);
    const onlineNo = voice('no-NO', 'OnlineNorwegian');
    const result = pickVoiceForLang([localNo, onlineNo], 'nb-NO');
    expect(result).toBe(localNo);
  });

  it('locale fallback prefers local over online (reversed input order)', () => {
    const onlineNo = voice('no-NO', 'OnlineNorwegian');
    const localNo = voice('no-NO', 'LocalNorwegian', true);
    const result = pickVoiceForLang([onlineNo, localNo], 'nb-NO');
    expect(result).toBe(localNo);
  });

  it('locale fallback works with uppercase target for Mongolian (MN → mn-MN)', () => {
    const voices = [voice('mn-MN')];
    const result = pickVoiceForLang(voices, 'MN');
    expect(result).toBe(voices[0]);
  });

  /* --- negative cases --- */

  it('returns undefined when no voice matches', () => {
    const voices = [voice('en-US')];
    expect(pickVoiceForLang(voices, 'ja')).toBeUndefined();
  });

  it('returns undefined for an empty voice list', () => {
    expect(pickVoiceForLang([], 'en-US')).toBeUndefined();
  });

  it('never cross-matches unrelated languages', () => {
    const voices = [voice('en-US'), voice('fr-FR')];
    expect(pickVoiceForLang(voices, 'ja')).toBeUndefined();
    expect(pickVoiceForLang(voices, 'ar')).toBeUndefined();
  });

  it('does not match "es" to "en" (different base language)', () => {
    const voices = [voice('en-US')];
    expect(pickVoiceForLang(voices, 'es')).toBeUndefined();
  });
});

/* ------------------------------------------------------------------ */
/*  29-language product code validation                                */
/* ------------------------------------------------------------------ */

describe('FREE_LANG_OPTIONS product codes', () => {
  it('contains exactly SUPPORTED_LANGUAGE_COUNT entries', () => {
    expect(FREE_LANG_OPTIONS.length).toBe(SUPPORTED_LANGUAGE_COUNT);
    expect(SUPPORTED_LANGUAGE_COUNT).toBe(30);
  });

  it('every entry has a non-empty code and key', () => {
    for (const opt of FREE_LANG_OPTIONS) {
      expect(opt.code.length).toBeGreaterThan(0);
      expect(opt.key.length).toBeGreaterThan(0);
    }
  });

  it('no entry has an obviously malformed BCP-47 code', () => {
    for (const opt of FREE_LANG_OPTIONS) {
      expect(opt.code).toMatch(/^[a-z]{2,4}(-[a-zA-Z0-9]+)?$/);
    }
  });

  it('resolver does not throw for every product code with en-US voices', () => {
    const dummyVoices = [voice('en-US')];
    for (const opt of FREE_LANG_OPTIONS) {
      expect(() => pickVoiceForLang(dummyVoices, opt.code)).not.toThrow();
    }
  });

  it('resolver does not throw for every product code with an empty voice list', () => {
    for (const opt of FREE_LANG_OPTIONS) {
      expect(() => pickVoiceForLang([], opt.code)).not.toThrow();
    }
  });

  it('resolver correctly matches a product code when a compatible voice is installed', () => {
    for (const opt of FREE_LANG_OPTIONS) {
      const matchingVoice = voice(opt.code, `Test-${opt.code}`);
      const result = pickVoiceForLang([matchingVoice], opt.code);
      expect(result).toBeDefined();
      expect(result?.lang).toBe(opt.code);
    }
  });

  it('fi and fil product codes exist and do not collide', () => {
    const fi = FREE_LANG_OPTIONS.find((o) => o.code === 'fi');
    const fil = FREE_LANG_OPTIONS.find((o) => o.code === 'fil');
    expect(fi).toBeDefined();
    expect(fil).toBeDefined();
    expect(fi!.code).not.toBe(fil!.code);
  });
});

/* ------------------------------------------------------------------ */
/*  Source-of-truth guards                                             */
/* ------------------------------------------------------------------ */

describe('source-of-truth guards', () => {
  it('SUPPORTED_LANGUAGE_COUNT is the canonical product-language count', () => {
    expect(SUPPORTED_LANGUAGE_COUNT).toBe(30);
  });

  it('FREE_LANG_OPTIONS is the canonical list of product languages', () => {
    expect(FREE_LANG_OPTIONS.length).toBe(30);
  });
});

/* ------------------------------------------------------------------ */
/*  Windows underscore locale normalization                            */
/* ------------------------------------------------------------------ */

describe('underscore locale normalization', () => {
  it('matches a Windows-style "mn_MN" voice tag for target "mn"', () => {
    const v = voice('mn_MN');
    expect(pickVoiceForLang([v], 'mn')).toBe(v);
  });

  it('matches a Windows-style voice tag exactly (es-ES target → es_ES voice)', () => {
    const v = voice('es_ES');
    expect(pickVoiceForLang([v], 'es-ES')).toBe(v);
  });

  it('base-fallback normalizes underscores on both sides (ja → ja_JP)', () => {
    const v = voice('ja_JP');
    expect(pickVoiceForLang([v], 'ja')).toBe(v);
  });

  it('normalizes an underscore in the TARGET too (zh_CN → zh-CN voice)', () => {
    const v = voice('zh-CN');
    expect(pickVoiceForLang([v], 'zh_CN')).toBe(v);
  });

  it('Norwegian fallback still resolves through underscore voice tags (nb-NO → no_NO)', () => {
    const v = voice('no_NO');
    expect(pickVoiceForLang([v], 'nb-NO')).toBe(v);
  });

  it('underscore normalization never cross-matches unrelated languages', () => {
    expect(pickVoiceForLang([voice('fi_FI')], 'fil')).toBeUndefined();
    expect(pickVoiceForLang([voice('fil_PH')], 'fi')).toBeUndefined();
  });
});

/* ------------------------------------------------------------------ */
/*  Persisted voice resolution (saved voiceURI safety)                 */
/* ------------------------------------------------------------------ */

describe('resolvePersistedVoice', () => {
  it('honors a persisted voice that matches the language exactly', () => {
    const v = voice('es-ES', 'SavedVoice');
    expect(resolvePersistedVoice([v], 'es-ES', 'SavedVoice-es-ES')).toBe(v);
  });

  it('honors a persisted regional variant of the same language', () => {
    const v = voice('es-MX', 'SavedVoice');
    expect(resolvePersistedVoice([v], 'es-ES', 'SavedVoice-es-MX')).toBe(v);
  });

  it('rejects a persisted voice from an UNRELATED language', () => {
    const v = voice('en-US', 'SavedEnglish');
    expect(resolvePersistedVoice([v], 'es-ES', 'SavedEnglish-en-US')).toBeUndefined();
  });

  it('rejects fi↔fil cross-language persisted picks', () => {
    const v = voice('fi-FI', 'SavedFinnish');
    expect(resolvePersistedVoice([v], 'fil', 'SavedFinnish-fi-FI')).toBeUndefined();
  });

  it('returns undefined for a voice that is no longer installed', () => {
    expect(resolvePersistedVoice([voice('es-ES')], 'es-ES', 'vanished-uri')).toBeUndefined();
  });

  it('returns undefined when no voiceURI was saved', () => {
    const v = voice('es-ES');
    expect(resolvePersistedVoice([v], 'es-ES', undefined)).toBeUndefined();
  });

  it('normalizes underscores when checking compatibility', () => {
    const v = voice('mn_MN', 'SavedMongolian');
    expect(resolvePersistedVoice([v], 'mn', 'SavedMongolian-mn_MN')).toBe(v);
  });
});

/* ------------------------------------------------------------------ */
/*  Full product sweep — all 29 languages against realistic registries */
/* ------------------------------------------------------------------ */

describe('all 29 product languages', () => {
  it('resolve against a regional-voice registry (Windows-style underscore tags)', () => {
    // Every product language has exactly one installed voice, tagged with a
    // Windows-style regional tag ("mn_MN"), and one unrelated decoy.
    const registry = FREE_LANG_OPTIONS.flatMap((o) => {
      const regional = o.code.includes('-')
        ? o.code.replace(/-/g, '_')
        : `${o.code}_${o.code.toUpperCase()}`;
      return [
        voice(regional, `Voice-${o.key}`),
        voice('xx-XX', `Decoy-${o.key}`),
      ];
    });
    for (const opt of FREE_LANG_OPTIONS) {
      const result = pickVoiceForLang(registry, opt.code);
      expect(result, `no voice resolved for ${opt.code}`).toBeDefined();
      expect(result!.name, `${opt.code} resolved the decoy`).toBe(`Voice-${opt.key}`);
    }
  });

  it('resolve against a hyphen regional registry (macOS/Android style)', () => {
    const registry = FREE_LANG_OPTIONS.map((o) =>
      voice(o.code.includes('-') ? o.code : `${o.code}-${o.code.toUpperCase()}`, `V-${o.key}`),
    );
    for (const opt of FREE_LANG_OPTIONS) {
      const result = pickVoiceForLang(registry, opt.code);
      expect(result, `no voice resolved for ${opt.code}`).toBeDefined();
      expect(result!.name).toBe(`V-${opt.key}`);
    }
  });

  it('never resolve when only unrelated-language voices are installed', () => {
    const unrelated = [voice('zz-ZA'), voice('xx-XX'), voice('qq_QQ')];
    for (const opt of FREE_LANG_OPTIONS) {
      expect(pickVoiceForLang(unrelated, opt.code), `${opt.code} matched an unrelated voice`)
        .toBeUndefined();
    }
  });

  it('resolve for every product language with an empty or still-loading registry', () => {
    // The "loading voices" state: resolver must return undefined (not throw,
    // not match a wrong voice) so the UI can show "Loading voices…".
    for (const opt of FREE_LANG_OPTIONS) {
      expect(pickVoiceForLang([], opt.code)).toBeUndefined();
    }
  });
});
