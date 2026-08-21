'use client';

import { useSyncExternalStore } from 'react';
import {
  getLibrarySyncSnapshot,
  subscribeLibrarySync,
  syncLibraryNow,
} from '@/lib/sync/client';

export function useLibrarySync() {
  const state = useSyncExternalStore(
    subscribeLibrarySync,
    getLibrarySyncSnapshot,
    getLibrarySyncSnapshot,
  );
  return { ...state, syncNow: syncLibraryNow };
}
