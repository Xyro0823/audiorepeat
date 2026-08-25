import { describe, expect, it } from 'vitest';
import {
  importBytesExceed,
  importFileBytesExceed,
  MAX_IMPORT_BYTES,
  MAX_IMPORT_WORDS,
} from './importLimits';
import { parseSetJsonChecked } from './io';
import { MAX_SYNC_BODY_BYTES, MAX_TOTAL_SYNC_WORDS } from '@/lib/sync/librarySync';
import { decodeSetFromUrl, encodeSetForUrl } from './share';

function makeWords(n: number): Array<{ target: string; translation: string }> {
  return Array.from({ length: n }, (_, i) => ({ target: `w${i}`, translation: `t${i}` }));
}

function jsonFor(words: unknown[]): string {
  return JSON.stringify({ format: 'audiorepeat-set', set: { name: 'S', words } });
}

describe('import size limits — boundaries', () => {
  it('word cap: exactly the limit imports; one over is rejected whole', () => {
    const at = parseSetJsonChecked(jsonFor(makeWords(MAX_IMPORT_WORDS)));
    expect(at.ok).toBe(true);

    const over = parseSetJsonChecked(jsonFor(makeWords(MAX_IMPORT_WORDS + 1)));
    expect(over).toEqual({ ok: false, error: 'too-many-words', limit: MAX_IMPORT_WORDS });
  });

  it('byte cap: input over 2MB is rejected BEFORE parsing', () => {
    const big = 'x'.repeat(MAX_IMPORT_BYTES + 1);
    // Even malformed oversized input reports too-large (not invalid): the
    // byte guard runs first so we never parse unbounded text.
    const res = parseSetJsonChecked(big);
    expect(res).toEqual({ ok: false, error: 'too-large' });
    expect(importBytesExceed(big)).toBe(true);
    expect(importBytesExceed('a'.repeat(MAX_IMPORT_BYTES))).toBe(false);
  });

  it('file-size guard mirrors the byte cap', () => {
    expect(importFileBytesExceed({ size: MAX_IMPORT_BYTES })).toBe(false);
    expect(importFileBytesExceed({ size: MAX_IMPORT_BYTES + 1 })).toBe(true);
  });

  it('malformed JSON still reports invalid (not a size error)', () => {
    expect(parseSetJsonChecked('{"set":')).toEqual({ ok: false, error: 'invalid' });
  });

  it('normal small imports are untouched by the guards', () => {
    const res = parseSetJsonChecked(jsonFor(makeWords(50)));
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.set.words).toHaveLength(50);
      expect(res.set.name).toBe('S');
    }
  });

  it('oversized sets are rejected WHOLE — no partial data escapes via share links', () => {
    const oversized = jsonFor(makeWords(MAX_IMPORT_WORDS + 5));
    const encoded = encodeSetForUrl(JSON.parse(oversized).set);
    // encode→decode round-trip must also refuse to produce an oversized set.
    expect(decodeSetFromUrl(encoded)).toBeNull();
  });

  it('limits stay compatible with server sync quotas', () => {
    // A max-size import must always fit inside what /api/sync accepts.
    expect(MAX_IMPORT_WORDS).toBeLessThanOrEqual(MAX_TOTAL_SYNC_WORDS);
    expect(MAX_IMPORT_BYTES).toBeLessThan(MAX_SYNC_BODY_BYTES);
  });

  it('starter-library batches (≤1000 words) stay well inside the cap', () => {
    expect(1000).toBeLessThan(MAX_IMPORT_WORDS);
  });
});
