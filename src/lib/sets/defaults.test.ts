import { describe, it, expect } from 'vitest';
import { resolveDefaultNewSetLang } from './defaults';

describe('resolveDefaultNewSetLang', () => {
  /* --- Pro / Lifetime --- */

  it('Pro preference "ja" returns "ja" directly', () => {
    expect(resolveDefaultNewSetLang(true, 'ja', null)).toBe('ja');
  });

  it('Pro with null preference returns undefined (no fallback to freeLangKey)', () => {
    expect(resolveDefaultNewSetLang(true, null, 'es')).toBeUndefined();
  });

  it('Pro with undefined preference returns undefined', () => {
    expect(resolveDefaultNewSetLang(true, undefined, 'mn')).toBeUndefined();
  });

  /* --- Free --- */

  it('Free key "es" resolves to BCP-47 "es-ES" via seedCodeForLangKey', () => {
    expect(resolveDefaultNewSetLang(false, null, 'es')).toBe('es-ES');
  });

  it('Free key "mn" resolves to BCP-47 "mn" via seedCodeForLangKey', () => {
    expect(resolveDefaultNewSetLang(false, null, 'mn')).toBe('mn');
  });

  it('Free with null key returns undefined', () => {
    expect(resolveDefaultNewSetLang(false, null, null)).toBeUndefined();
  });

  it('Free with undefined key returns undefined', () => {
    expect(resolveDefaultNewSetLang(false, null, undefined)).toBeUndefined();
  });

  /* --- Edge cases --- */

  it('Pro ignores defaultNewSetLang even when freeLangKey is also set', () => {
    // Pro should never read freeLangKey — it's an entitlement field
    expect(resolveDefaultNewSetLang(true, 'ja', 'es')).toBe('ja');
  });

  it('Free ignores defaultNewSetLang — it is Pro-only', () => {
    expect(resolveDefaultNewSetLang(false, 'ja', 'es')).toBe('es-ES');
  });
});
