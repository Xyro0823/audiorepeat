/**
 * Pure library search/filter logic, extracted from SetLibrary so the
 * per-keystroke cost is a cheap array pass over precomputed lowercase docs
 * and the semantics are regression-tested.
 *
 * Semantics (identical to the original inline filter):
 *  - CEFR, language and query filters are AND'd together;
 *  - the query matches a set when EITHER the name OR the language label
 *    contains it as a substring (fields are never joined, so a query can
 *    never match across the field boundary);
 *  - the input order is preserved.
 */
import type { CefrLevel, VocabSet } from '@/types/app';

export interface SetSearchDoc {
  set: VocabSet;
  nameLower: string;
  langLabelLower: string;
}

/** Precompute the searchable fields once per library change. */
export function buildSetSearchDocs(
  sets: VocabSet[],
  langLabelFor: (code: string) => string,
): SetSearchDoc[] {
  return sets.map((set) => ({
    set,
    nameLower: set.name.toLowerCase(),
    langLabelLower: langLabelFor(set.lang).toLowerCase(),
  }));
}

export interface LibraryFilters {
  query: string;
  cefr: CefrLevel | 'all';
  lang: string;
}

/** Order-preserving filter over the prepared docs. Pure — no hidden state. */
export function filterLibrarySets(docs: SetSearchDoc[], f: LibraryFilters): VocabSet[] {
  const q = f.query.trim().toLowerCase();
  return docs
    .filter((doc) => {
      if (f.cefr !== 'all' && doc.set.cefr !== f.cefr) return false;
      if (f.lang !== 'all' && doc.set.lang !== f.lang) return false;
      if (
        q &&
        !doc.nameLower.includes(q) &&
        !doc.langLabelLower.includes(q)
      ) {
        return false;
      }
      return true;
    })
    .map((doc) => doc.set);
}

/* ------------------------------------------------------------------ */
/* Search-input debounce                                               */
/* ------------------------------------------------------------------ */

/**
 * Debounce transition for the search box (pure; unit-tested):
 *  - typing schedules a commit after the delay (rapid keystrokes keep
 *    rescheduling — only the settled value reaches the grid);
 *  - CLEARING commits immediately so resetting the search feels instant;
 *  - an already-committed value is idle.
 */
export function debounceAction(committed: string, incoming: string): 'commit-now' | 'schedule' | 'idle' {
  if (incoming === committed) return 'idle';
  if (incoming === '') return 'commit-now';
  return 'schedule';
}

/** Keystroke settle time for the library search box. */
export const SEARCH_DEBOUNCE_MS = 180;
