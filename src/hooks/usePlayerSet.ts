'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { AppSettings, VocabSet } from '@/types/app';
import { getAuthSnapshot, subscribeAuth } from '@/lib/authStore';
import {
  accountPrefsActivatedFor,
  activateAccountPrefs,
  EMPTY_ACCOUNT_PREFS,
  getAccountPrefsSnapshot,
  subscribeAccountPrefs,
} from '@/lib/accountPrefs';
import { langLimitKey } from '@/lib/planGate';
import { getDeletedSetIds, getSetById, putSet } from '@/lib/db/indexedDb';
import { scheduleLibrarySync, syncLibraryNow } from '@/lib/sync/client';
import {
  activateSettingsOwner,
  getSettingsSnapshot,
  hydrateSettings,
  refreshSettings,
  subscribeSettings,
  updateSettings,
} from '@/lib/settingsStore';
import { readOnboardingPending } from '@/lib/onboarding';
import { activateSetOwner } from '@/lib/db/indexedDb';

/**
 * Player-scoped library access: loads ONLY the requested set instead of
 * deserializing the whole IndexedDB library (`useLists` stays untouched for
 * the dashboard). Preserves the semantics PlayerView depends on:
 *
 *  - account scoping: owner activation + the same per-uid database as
 *    useLists; re-reads on sign-in/sign-out/account switch;
 *  - deleted sets (tombstones) and hidden-language sets resolve to `null`,
 *    exactly like a set missing from useLists' visible list → the existing
 *    "set not found" screen;
 *  - settings ride the SAME shared store (plan gates, TTS prefs) and are
 *    hydrated/refreshed identically;
 *  - saveSet keeps its contract: persist + tombstone clear + sync queue +
 *    local state update + scheduled cloud sync;
 *  - remote merges still arrive: syncs run fire-and-forget and the
 *    library-synced / data-changed events re-read just the target set.
 */
export function usePlayerSet(setId: string | null) {
  const [set, setSet] = useState<VocabSet | null>(null);
  const [loading, setLoading] = useState(true);
  const settings = useSyncExternalStore(subscribeSettings, getSettingsSnapshot, getSettingsSnapshot);
  const accountSnapshot = useSyncExternalStore(
    subscribeAccountPrefs,
    getAccountPrefsSnapshot,
    getAccountPrefsSnapshot,
  );
  const uid = getAuthSnapshot().user?.id ?? null;
  // Hidden-language parity with useLists' visibleSets filter.
  const accountPrefs = accountPrefsActivatedFor(uid)
    ? accountSnapshot
    : EMPTY_ACCOUNT_PREFS;

  /** Re-read only the target set (owner-scoped, tombstone-aware). */
  const reload = useCallback(
    async (alive: () => boolean): Promise<VocabSet | null> => {
      if (!setId) return null;
      const [found, deletedIds] = await Promise.all([getSetById(setId), getDeletedSetIds()]);
      const next = found && !deletedIds.has(setId) ? found : null;
      if (alive()) setSet(next);
      return next;
    },
    [setId],
  );

  // Initial load — mirrors useLists' owner activation order but reads one key.
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const currentUid = getAuthSnapshot().user?.id ?? null;
        activateSetOwner(currentUid);
        activateSettingsOwner(currentUid);
        await hydrateSettings();
        if (currentUid && !accountPrefsActivatedFor(currentUid)) {
          activateAccountPrefs(currentUid, getSettingsSnapshot(), {
            skipAdoption: !!readOnboardingPending(currentUid),
          });
        }
        await reload(() => alive);
        if (!alive) return;
        setLoading(false);
        // Offline-first: render the local set immediately; signed-in accounts
        // merge remote changes in the background (the synced-event reloads).
        if (currentUid && setId) {
          void syncLibraryNow()
            .catch(() => undefined)
            .then(() => reload(() => alive));
        }
      } catch {
        // Storage failure behaves like "set not found" rather than hanging.
        if (alive) {
          setSet(null);
          setLoading(false);
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [reload, setId]);

  // Sign-in / sign-out / account switch AFTER mount: swap owners, hydrate that
  // account's settings, then re-read the target from ITS scoped database.
  const seenOwnerRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    const onAuthChange = () => {
      const next = getAuthSnapshot().user?.id ?? null;
      if (seenOwnerRef.current === undefined) {
        seenOwnerRef.current = next;
        return;
      }
      if (next === seenOwnerRef.current) return;
      seenOwnerRef.current = next;
      setLoading(true);
      void (async () => {
        activateSetOwner(next);
        activateSettingsOwner(next);
        await hydrateSettings();
        await reload(() => true);
        setLoading(false);
      })();
    };
    return subscribeAuth(onAuthChange);
  }, [reload]);

  // Cross-tab/focus freshness without full-library work on the hot path.
  useEffect(() => {
    const sync = () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      void refreshSettings();
      if (getAuthSnapshot().user) {
        void syncLibraryNow()
          .catch(() => undefined)
          .then(() => reload(() => true));
      }
    };
    document.addEventListener('visibilitychange', sync);
    window.addEventListener('focus', sync);
    return () => {
      document.removeEventListener('visibilitychange', sync);
      window.removeEventListener('focus', sync);
    };
  }, [reload]);

  // Onboarding seeds / cloud merges write through IndexedDB and announce it.
  useEffect(() => {
    const reloadOnDataChange = () => {
      void reload(() => true);
    };
    window.addEventListener('audiorepeat:data-changed', reloadOnDataChange);
    window.addEventListener('audiorepeat:library-synced', reloadOnDataChange);
    return () => {
      window.removeEventListener('audiorepeat:data-changed', reloadOnDataChange);
      window.removeEventListener('audiorepeat:library-synced', reloadOnDataChange);
    };
  }, [reload]);

  const saveSet = useCallback(
    async (next: VocabSet): Promise<VocabSet> => {
      const withTimestamp = { ...next, updatedAt: Date.now() };
      await putSet(withTimestamp);
      setSet(withTimestamp);
      scheduleLibrarySync();
      return withTimestamp;
    },
    [],
  );

  const saveSettings = useCallback((patch: Partial<AppSettings>) => {
    updateSettings(patch);
  }, []);

  // Hidden-language parity with useLists' visibleSets filter: a language
  // hidden by a Free downgrade resolves to null (the "set not found" screen),
  // reactively — the account-prefs subscription re-renders on changes.
  const visibleSet = useMemo(() => {
    if (!set) return null;
    return accountPrefs.hiddenLangs.includes(langLimitKey(set.lang)) ? null : set;
  }, [set, accountPrefs.hiddenLangs]);

  return {
    set: visibleSet,
    loading,
    settings,
    saveSettings,
    saveSet,
  };
}
