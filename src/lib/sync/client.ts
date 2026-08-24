'use client';

import { getAuthIdToken, getAuthSnapshot } from '@/lib/authStore';
import {
  acknowledgeSync,
  getAllSets,
  getPendingSyncPayload,
  getSyncCursor,
  mergeRemoteLibrary,
  setSyncCursor,
} from '@/lib/db/indexedDb';
import { sanitizeSyncPayload } from '@/lib/sync/librarySync';
import { applyMergedProgress, buildProgressPayload } from '@/lib/sync/progressClient';
import type { VocabSet } from '@/types/app';

export type LibrarySyncPhase = 'idle' | 'syncing' | 'synced' | 'offline' | 'error';

export interface LibrarySyncSnapshot {
  phase: LibrarySyncPhase;
  lastSyncedAt: number | null;
}

let snapshot: LibrarySyncSnapshot = { phase: 'idle', lastSyncedAt: null };
let inFlight: Promise<VocabSet[]> | null = null;
let timer: number | null = null;
/**
 * One-shot flag: the next sync pushes progress with REPLACE semantics
 * (backup restore / clear stats) so the server adopts the local view
 * wholesale instead of max-merging with history being overwritten.
 */
let replaceProgressOnce = false;
const listeners = new Set<() => void>();

/** Queue a one-shot full replace of remote learning progress. */
export function requestProgressReplace(): void {
  if (!getAuthSnapshot().user) return;
  replaceProgressOnce = true;
}

function update(next: LibrarySyncSnapshot): void {
  snapshot = next;
  for (const listener of [...listeners]) listener();
}

export function subscribeLibrarySync(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getLibrarySyncSnapshot(): LibrarySyncSnapshot {
  return snapshot;
}

/** Push local changes and pull the merged remote library in one round trip. */
export async function syncLibraryNow(): Promise<VocabSet[]> {
  if (inFlight) return inFlight;
  inFlight = (async () => {
    const local = await getAllSets();
    const uid = getAuthSnapshot().user?.id;
    if (!uid) return local;
    if (!navigator.onLine) {
      update({ ...snapshot, phase: 'offline' });
      return local;
    }
    const token = await getAuthIdToken().catch(() => null);
    if (!token) {
      update({ ...snapshot, phase: 'offline' });
      return local;
    }
    update({ ...snapshot, phase: 'syncing' });
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 12_000);
    try {
      const pending = await getPendingSyncPayload();
      // Learning progress rides the same authenticated round trip (state
      // based + idempotent); the merged truth comes back on the response.
      const progress = buildProgressPayload(uid, replaceProgressOnce);
      replaceProgressOnce = false;
      const response = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          sets: pending.sets,
          tombstones: pending.tombstones,
          since: await getSyncCursor(),
          ...(progress ? { progress } : {}),
        }),
        signal: controller.signal,
      });
      if (!response.ok) {
        update({ ...snapshot, phase: response.status >= 500 ? 'offline' : 'error' });
        return local;
      }
      const body = await response.json() as unknown;
      const remote = sanitizeSyncPayload(body);
      if (!remote) {
        update({ ...snapshot, phase: 'error' });
        return local;
      }
      // Apply the account's merged learning progress before anything else —
      // a late response after an account switch is dropped by the guard.
      let progressChanged = false;
      try {
        progressChanged = applyMergedProgress(uid, (body as { progress?: unknown }).progress) !== null;
      } catch {
        /* progress is best-effort: never fail the library sync over it */
      }
      if (progressChanged) {
        // Let mounted stats consumers re-read their (updated) local keys.
        try {
          window.dispatchEvent(new CustomEvent('audiorepeat:progress-synced'));
        } catch {
          /* eventing unavailable */
        }
      }
      const merged = await mergeRemoteLibrary(remote.sets, remote.tombstones);
      await acknowledgeSync(pending.entries);
      const cursor = (body as { syncedAt?: unknown }).syncedAt;
      if (typeof cursor === 'number' && Number.isFinite(cursor)) await setSyncCursor(cursor);
      update({ phase: 'synced', lastSyncedAt: Date.now() });
      // The merge wrote directly to IndexedDB; let any mounted library
      // re-read it so the visible cards match the merged result.
      try {
        window.dispatchEvent(new CustomEvent('audiorepeat:library-synced'));
      } catch {
        /* eventing unavailable: callers still get the return value */
      }
      return merged;
    } catch {
      update({ ...snapshot, phase: navigator.onLine ? 'error' : 'offline' });
      return local;
    } finally {
      window.clearTimeout(timeout);
    }
  })();
  try {
    return await inFlight;
  } finally {
    inFlight = null;
  }
}

/** Coalesce rapid player/edit writes into one network sync. */
export function scheduleLibrarySync(delayMs = 900): void {
  if (!getAuthSnapshot().user) return;
  if (timer !== null) window.clearTimeout(timer);
  timer = window.setTimeout(() => {
    timer = null;
    void syncLibraryNow();
  }, delayMs);
}
