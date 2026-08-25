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

// ---------- reconnect / retry / cross-tab resilience ----------

/** Cross-tab serialization so two tabs never race the same sync round trip. */
const SYNC_LOCK_NAME = 'audiorepeat-library-sync';

const MAX_RETRY_ATTEMPTS = 5;
const BASE_RETRY_DELAY_MS = 2_000;
const MAX_RETRY_DELAY_MS = 60_000;

let retryAttempts = 0;
let retryTimer: number | null = null;
let lastSyncedUid: string | null | undefined;

/**
 * Pure exponential backoff with a hard cap, exported for tests. Attempts are
 * 0-based; the cap keeps worst-case delay bounded to avoid retry storms.
 */
export function nextRetryDelayMs(attempts: number): number {
  return Math.min(BASE_RETRY_DELAY_MS * 2 ** Math.max(0, attempts), MAX_RETRY_DELAY_MS);
}

function clearRetryTimer(): void {
  if (retryTimer !== null) {
    window.clearTimeout(retryTimer);
    retryTimer = null;
  }
}

/** Schedule the next retry unless the cap is exhausted. */
function scheduleRetry(): void {
  if (retryAttempts >= MAX_RETRY_ATTEMPTS) return;
  const delay = nextRetryDelayMs(retryAttempts);
  retryAttempts += 1;
  clearRetryTimer();
  retryTimer = window.setTimeout(() => {
    retryTimer = null;
    void syncLibraryNow();
  }, delay);
}

function resetRetries(): void {
  retryAttempts = 0;
  clearRetryTimer();
}

/** Serialize the network round trip across tabs (fallback: no-op wrapper). */
async function withSyncLock<T>(fn: () => Promise<T>): Promise<T> {
  if (typeof navigator === 'undefined' || !navigator.locks?.request) return fn();
  return navigator.locks.request(SYNC_LOCK_NAME, () => fn());
}

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
    // Account switching must never inherit the previous account's backoff.
    if (lastSyncedUid !== undefined && lastSyncedUid !== uid) resetRetries();
    lastSyncedUid = uid;
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
    // The lock only serializes the network round trip across tabs: local
    // reads/merges stay outside so a queued tab never merges stale state.
    const attempt = async (): Promise<VocabSet[]> => {
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
    };
    const result = await withSyncLock(attempt);
    if (snapshot.phase === 'synced') resetRetries();
    else scheduleRetry();
    return result;
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

// Reconnect: a browser "online" event always means connectivity changed, so
// drop the backoff and resync promptly (bounded by scheduleLibrarySync's
// coalescing — never a retry storm).
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    resetRetries();
    scheduleLibrarySync(500);
  });
}
