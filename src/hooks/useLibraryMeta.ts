'use client';

import { useEffect, useSyncExternalStore } from 'react';
import {
  getLibraryMetaSnapshot,
  hydrateLibraryMeta,
  subscribeLibraryMeta,
  toggleFavorite,
} from '@/lib/libraryMeta';

/**
 * Reactive access to the library metadata store: recently practiced sets and
 * bookmarks. Hydrates from localStorage once after first paint (SSR-safe).
 */
export function useLibraryMeta() {
  const meta = useSyncExternalStore(
    subscribeLibraryMeta,
    getLibraryMetaSnapshot,
    getLibraryMetaSnapshot,
  );

  useEffect(() => {
    hydrateLibraryMeta();
  }, []);

  return { recents: meta.recents, favorites: meta.favorites, toggleFavorite };
}
