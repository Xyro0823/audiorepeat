import type { VocabSet } from '@/types/app';

/**
 * Lightweight client-side metadata about the user's library: which sets were
 * practiced most recently (for the "Continue Practice" sidebar) and which are
 * bookmarked (for the featured spotlight card). Stored in localStorage using
 * the same module-store + subscribe pattern as settingsStore so the dashboard
 * and the player share one consistent view.
 */

export interface RecentSetEntry {
  setId: string;
  name: string;
  lang: string;
  cefr?: VocabSet['cefr'];
  at: number;
}

export interface LibraryMeta {
  recents: RecentSetEntry[];
  favorites: string[];
}

const STORAGE_KEY = 'audiorepeat-library-meta-v1';
const MAX_RECENTS = 10;

const EMPTY: LibraryMeta = { recents: [], favorites: [] };

let meta: LibraryMeta = EMPTY;
let hydrated = false;
let persistTimer: number | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  for (const l of listeners) l();
}

export function subscribeLibraryMeta(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Stable snapshot for useSyncExternalStore. */
export function getLibraryMetaSnapshot(): LibraryMeta {
  return meta;
}

function load(): LibraryMeta {
  if (typeof window === 'undefined') return EMPTY;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<LibraryMeta>;
      return {
        recents: Array.isArray(parsed.recents) ? parsed.recents : [],
        favorites: Array.isArray(parsed.favorites) ? parsed.favorites : [],
      };
    }
  } catch {
    /* corrupted storage — start fresh */
  }
  return EMPTY;
}

function persist(): void {
  if (persistTimer !== null) clearTimeout(persistTimer);
  persistTimer = window.setTimeout(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(meta));
    } catch {
      /* storage unavailable */
    }
  }, 200);
}

/** Load persisted meta once (idempotent across hook instances). */
export function hydrateLibraryMeta(): void {
  if (hydrated) return;
  hydrated = true;
  meta = load();
  emit();
}

/** Stamp a set as just practiced; bumps it to the top of the recents list. */
export function recordSetPlayed(
  set: Pick<VocabSet, 'id' | 'name' | 'lang' | 'cefr'>,
): void {
  hydrateLibraryMeta();
  const entry: RecentSetEntry = {
    setId: set.id,
    name: set.name,
    lang: set.lang,
    cefr: set.cefr,
    at: Date.now(),
  };
  meta = {
    ...meta,
    recents: [entry, ...meta.recents.filter((r) => r.setId !== set.id)].slice(
      0,
      MAX_RECENTS,
    ),
  };
  emit();
  persist();
}

/** Toggle a set's bookmark. Returns the new state (true = now bookmarked). */
export function toggleFavorite(setId: string): boolean {
  hydrateLibraryMeta();
  const has = meta.favorites.includes(setId);
  meta = {
    ...meta,
    favorites: has
      ? meta.favorites.filter((id) => id !== setId)
      : [setId, ...meta.favorites],
  };
  emit();
  persist();
  return !has;
}
