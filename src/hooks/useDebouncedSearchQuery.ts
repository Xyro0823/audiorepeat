'use client';

import { useEffect, useState } from 'react';
import {
  SEARCH_DEBOUNCE_MS,
  debounceAction,
} from '@/lib/sets/search';

/**
 * Debounced value for the library search input. Typing waits for the settle
 * delay (rapid keystrokes reschedule the timer), while clearing commits
 * immediately — see `debounceAction` for the tested transition rules.
 */
export function useDebouncedSearchQuery(query: string, delayMs = SEARCH_DEBOUNCE_MS): string {
  const [debounced, setDebounced] = useState(query);
  useEffect(() => {
    const action = debounceAction(debounced, query);
    if (action === 'idle') return;
    // Clearing goes through a 0ms macrotask: effectively immediate, while
    // normal typing waits out the full settle delay.
    const id = window.setTimeout(() => setDebounced(query), action === 'commit-now' ? 0 : delayMs);
    return () => window.clearTimeout(id);
  }, [debounced, query, delayMs]);
  return debounced;
}
