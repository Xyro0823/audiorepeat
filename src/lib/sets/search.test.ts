import { describe, expect, it } from 'vitest';
import type { CefrLevel, VocabSet } from '@/types/app';
import {
  SEARCH_DEBOUNCE_MS,
  buildSetSearchDocs,
  debounceAction,
  filterLibrarySets,
} from './search';

const labelFor = (code: string): string =>
  ({ 'es-ES': 'Spanish', 'ja-JP': 'Japanese', 'de-DE': 'German' })[code] ?? code;

function makeSet(id: string, name: string, lang: string, cefr?: CefrLevel): VocabSet {
  return {
    id,
    name,
    lang,
    ...(cefr ? { cefr } : {}),
    words: [{ id: `${id}-w`, target: 't', translation: 'tr' }],
  } as unknown as VocabSet;
}

/** Naive reference implementation of the ORIGINAL semantics. */
function referenceFilter(
  sets: VocabSet[],
  query: string,
  cefr: CefrLevel | 'all',
  lang: string,
): VocabSet[] {
  const q = query.trim().toLowerCase();
  return sets.filter((s) => {
    if (cefr !== 'all' && s.cefr !== cefr) return false;
    if (lang !== 'all' && s.lang !== lang) return false;
    if (
      q &&
      !s.name.toLowerCase().includes(q) &&
      !labelFor(s.lang).toLowerCase().includes(q)
    ) {
      return false;
    }
    return true;
  });
}

function library(n: number): VocabSet[] {
  const langs = ['es-ES', 'ja-JP', 'de-DE'];
  const cefrs: Array<CefrLevel | undefined> = ['A1', 'B2', undefined];
  return Array.from({ length: n }, (_, i) =>
    makeSet(`s${i}`, `Set ${i} vocab`, langs[i % langs.length], cefrs[i % cefrs.length]),
  );
}

function docs(sets: VocabSet[]) {
  return buildSetSearchDocs(sets, labelFor);
}

describe('filterLibrarySets', () => {
  it('handles an empty library', () => {
    expect(filterLibrarySets([], { query: '', cefr: 'all', lang: 'all' })).toEqual([]);
    expect(filterLibrarySets([], { query: 'x', cefr: 'A1', lang: 'es-ES' })).toEqual([]);
  });

  it('matches the original semantics on a 50-set library', () => {
    const sets = library(50);
    for (const query of ['', 'set', 'VOCAB', 'spanish', '3 ', 'zzz']) {
      for (const cefr of ['all', 'A1'] as const) {
        for (const lang of ['all', 'ja-JP']) {
          expect(filterLibrarySets(docs(sets), { query, cefr, lang })).toEqual(
            referenceFilter(sets, query, cefr, lang),
          );
        }
      }
    }
  });

  it('scales to a 200+ set library and preserves order', () => {
    const sets = library(250);
    const result = filterLibrarySets(docs(sets), { query: 'vocab', cefr: 'all', lang: 'all' });
    expect(result.length).toBe(250); // every synthetic name contains "vocab"
    expect(result.map((s) => s.id)).toEqual(sets.map((s) => s.id)); // order preserved
    // A selective query narrows deterministically.
    const narrow = filterLibrarySets(docs(sets), { query: 'set 12', cefr: 'all', lang: 'all' });
    expect(narrow.map((s) => s.id)).toEqual(referenceFilter(sets, 'set 12', 'all', 'all').map((s) => s.id));
  });

  it('never matches across the field boundary', () => {
    const sets = [makeSet('a', 'Food', 'es-ES')]; // label "Spanish"
    // "od sp" would only match if name+label were concatenated.
    expect(filterLibrarySets(docs(sets), { query: 'od sp', cefr: 'all', lang: 'all' })).toEqual([]);
  });

  it('combines language and CEFR filters with the query', () => {
    const sets = library(60);
    const result = filterLibrarySets(docs(sets), { query: 'set', cefr: 'B2', lang: 'de-DE' });
    expect(result).toEqual(referenceFilter(sets, 'set', 'B2', 'de-DE'));
    expect(result.every((s) => s.cefr === 'B2' && s.lang === 'de-DE')).toBe(true);
  });

  it('is pure — repeated calls never go stale', () => {
    const d = docs(library(30));
    const first = filterLibrarySets(d, { query: 'spanish', cefr: 'all', lang: 'all' });
    const second = filterLibrarySets(d, { query: '', cefr: 'all', lang: 'all' });
    const third = filterLibrarySets(d, { query: 'spanish', cefr: 'all', lang: 'all' });
    expect(first).toEqual(third);
    expect(second.length).toBe(30);
  });
});

describe('debounceAction (search-input transitions)', () => {
  it('schedules normal typing', () => {
    expect(debounceAction('', 'a')).toBe('schedule');
    expect(debounceAction('ap', 'app')).toBe('schedule');
  });

  it('commits clearing immediately', () => {
    expect(debounceAction('app', '')).toBe('commit-now');
  });

  it('is idle when nothing changed', () => {
    expect(debounceAction('app', 'app')).toBe('idle');
    expect(debounceAction('', '')).toBe('idle');
  });

  it('exposes a bounded settle delay', () => {
    expect(SEARCH_DEBOUNCE_MS).toBeGreaterThanOrEqual(100);
    expect(SEARCH_DEBOUNCE_MS).toBeLessThanOrEqual(300);
  });
});
