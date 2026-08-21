import { deleteDB, openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { AppSettings, VocabSet } from '@/types/app';

interface AudioRepeatDB extends DBSchema {
  sets: { key: string; value: VocabSet };
  settings: { key: string; value: { key: string; value: AppSettings } };
  tombstones: { key: string; value: SetTombstone };
  syncQueue: { key: string; value: SyncQueueEntry };
  syncState: { key: string; value: { key: string; value: number } };
}

export interface SetTombstone {
  id: string;
  deletedAt: number;
}

export interface SyncQueueEntry {
  id: string;
  kind: 'set' | 'deleted';
  changedAt: number;
}

const DB_VERSION = 4;
const LEGACY_DB_NAME = 'audiorepeat';
const LEGACY_CLAIM_KEY = 'audiorepeat-library-claimed-by';
let globalDbPromise: Promise<IDBPDatabase<AudioRepeatDB>> | null = null;
let activeOwner: string | null = null;
let setDbPromise: Promise<IDBPDatabase<AudioRepeatDB>> | null = null;

function upgrade(db: IDBPDatabase<AudioRepeatDB>): void {
  if (!db.objectStoreNames.contains('sets')) {
    db.createObjectStore('sets', { keyPath: 'id' });
  }
  if (!db.objectStoreNames.contains('settings')) {
    db.createObjectStore('settings', { keyPath: 'key' });
  }
  if (!db.objectStoreNames.contains('tombstones')) {
    db.createObjectStore('tombstones', { keyPath: 'id' });
  }
  if (!db.objectStoreNames.contains('syncQueue')) {
    db.createObjectStore('syncQueue', { keyPath: 'id' });
  }
  if (!db.objectStoreNames.contains('syncState')) {
    db.createObjectStore('syncState', { keyPath: 'key' });
  }
}

export function setDatabaseNameForOwner(owner: string | null | undefined): string {
  return owner ? `audiorepeat-user-${encodeURIComponent(owner)}` : LEGACY_DB_NAME;
}

/** Select the account-scoped library database before any set operation. */
export function activateSetOwner(owner: string | null | undefined): void {
  const next = owner ?? null;
  if (activeOwner === next && setDbPromise) return;
  void setDbPromise?.then((db) => db.close()).catch(() => {});
  activeOwner = next;
  setDbPromise = null;
}

/** Remove one deleted account's local library without touching any other UID. */
export async function deleteSetDatabaseForOwner(owner: string): Promise<void> {
  const name = setDatabaseNameForOwner(owner);
  if (activeOwner === owner) activateSetOwner(null);
  await deleteDB(name);
}

function openNamedDb(name: string): Promise<IDBPDatabase<AudioRepeatDB>> {
  return openDB<AudioRepeatDB>(name, DB_VERSION, { upgrade });
}

export function getDb(): Promise<IDBPDatabase<AudioRepeatDB>> {
  globalDbPromise ??= openNamedDb(LEGACY_DB_NAME);
  return globalDbPromise;
}

function getSetDb(): Promise<IDBPDatabase<AudioRepeatDB>> {
  setDbPromise ??= openNamedDb(setDatabaseNameForOwner(activeOwner));
  return setDbPromise;
}

export async function getAllSets(): Promise<VocabSet[]> {
  const db = await getSetDb();
  const sets = await db.getAll('sets');
  return sets.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function putSet(set: VocabSet): Promise<void> {
  const db = await getSetDb();
  const tx = db.transaction(['sets', 'tombstones', 'syncQueue'], 'readwrite');
  await tx.objectStore('sets').put(set);
  await tx.objectStore('tombstones').delete(set.id);
  await tx.objectStore('syncQueue').put({ id: set.id, kind: 'set', changedAt: set.updatedAt });
  await tx.done;
}

export async function deleteSet(id: string, deletedAt = Date.now()): Promise<void> {
  const db = await getSetDb();
  const tx = db.transaction(['sets', 'tombstones', 'syncQueue'], 'readwrite');
  await tx.objectStore('sets').delete(id);
  const previous = await tx.objectStore('tombstones').get(id);
  await tx.objectStore('tombstones').put({ id, deletedAt: Math.max(previous?.deletedAt ?? 0, deletedAt) });
  await tx.objectStore('syncQueue').put({ id, kind: 'deleted', changedAt: deletedAt });
  await tx.done;
}

export async function clearAllSets(): Promise<void> {
  const db = await getSetDb();
  const tx = db.transaction(['sets', 'tombstones', 'syncQueue'], 'readwrite');
  const sets = await tx.objectStore('sets').getAll();
  const deletedAt = Date.now();
  await tx.objectStore('sets').clear();
  for (const set of sets) {
    await tx.objectStore('tombstones').put({ id: set.id, deletedAt });
    await tx.objectStore('syncQueue').put({ id: set.id, kind: 'deleted', changedAt: deletedAt });
  }
  await tx.done;
}

export async function getSetTombstones(): Promise<SetTombstone[]> {
  return (await getSetDb()).getAll('tombstones');
}

export async function getDeletedSetIds(): Promise<Set<string>> {
  return new Set((await getSetTombstones()).map((entry) => entry.id));
}

export async function getSettings(): Promise<AppSettings | undefined> {
  const db = await getDb();
  return (await db.get('settings', 'global'))?.value;
}

export async function putSettings(settings: AppSettings): Promise<void> {
  const db = await getDb();
  await db.put('settings', { key: 'global', value: settings });
}

/** Atomically replace the database-backed slices restored from a backup. */
export async function replaceBackupData(settings: AppSettings, sets: VocabSet[]): Promise<void> {
  const [globalDb, setDb] = await Promise.all([getDb(), getSetDb()]);
  const tx = setDb.transaction(['sets', 'tombstones', 'syncQueue'], 'readwrite');
  const previous = await tx.objectStore('sets').getAll();
  const nextIds = new Set(sets.map((set) => set.id));
  const deletedAt = Date.now();
  await tx.objectStore('sets').clear();
  for (const old of previous) {
    if (!nextIds.has(old.id)) {
      await tx.objectStore('tombstones').put({ id: old.id, deletedAt });
      await tx.objectStore('syncQueue').put({ id: old.id, kind: 'deleted', changedAt: deletedAt });
    }
  }
  for (const set of sets) {
    await tx.objectStore('sets').put(set);
    await tx.objectStore('tombstones').delete(set.id);
    await tx.objectStore('syncQueue').put({ id: set.id, kind: 'set', changedAt: set.updatedAt });
  }
  await tx.done;
  await globalDb.put('settings', { key: 'global', value: settings });
}

/**
 * One-time privacy migration. The first signed-in account after this release
 * claims the old unscoped library; it is copied before the guest database is
 * cleared, so a crash cannot destroy data. Later accounts never inherit it.
 */
export async function migrateLegacySetsToOwner(owner: string): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  activateSetOwner(owner);
  const scoped = await getSetDb();
  const scopedCount = await scoped.count('sets');
  let claimedBy: string | null = null;
  try {
    claimedBy = window.localStorage.getItem(LEGACY_CLAIM_KEY);
  } catch {
    /* storage unavailable: clearing the source still prevents cross-account reuse */
  }
  const legacy = await getDb();
  if (claimedBy && claimedBy !== owner) return false;
  const legacySets = await legacy.getAll('sets');
  if (legacySets.length === 0) return claimedBy === owner;
  if (scopedCount === 0) {
    const tx = scoped.transaction(['sets', 'syncQueue'], 'readwrite');
    for (const set of legacySets) {
      await tx.objectStore('sets').put(set);
      await tx.objectStore('syncQueue').put({ id: set.id, kind: 'set', changedAt: set.updatedAt });
    }
    await tx.done;
  }
  try {
    window.localStorage.setItem(LEGACY_CLAIM_KEY, owner);
  } catch {
    /* copied data remains safe even without the marker */
  }
  await legacy.clear('sets');
  return true;
}

/** Merge the server's authoritative last-write-wins view without losing a
 * local edit that happened while the request was in flight. */
export async function mergeRemoteLibrary(
  remoteSets: VocabSet[],
  remoteTombstones: SetTombstone[],
): Promise<VocabSet[]> {
  const db = await getSetDb();
  const tx = db.transaction(['sets', 'tombstones'], 'readwrite');
  const localSets = new Map((await tx.objectStore('sets').getAll()).map((set) => [set.id, set]));
  const localDeleted = new Map(
    (await tx.objectStore('tombstones').getAll()).map((entry) => [entry.id, entry]),
  );
  for (const set of remoteSets) {
    const local = localSets.get(set.id);
    const deleted = localDeleted.get(set.id);
    if ((local?.updatedAt ?? 0) > set.updatedAt || (deleted?.deletedAt ?? 0) >= set.updatedAt) continue;
    await tx.objectStore('sets').put(set);
    await tx.objectStore('tombstones').delete(set.id);
  }
  for (const deleted of remoteTombstones) {
    const local = localSets.get(deleted.id);
    const previous = localDeleted.get(deleted.id);
    if ((local?.updatedAt ?? 0) > deleted.deletedAt) continue;
    await tx.objectStore('sets').delete(deleted.id);
    await tx.objectStore('tombstones').put({
      id: deleted.id,
      deletedAt: Math.max(previous?.deletedAt ?? 0, deleted.deletedAt),
    });
  }
  await tx.done;
  return getAllSets();
}

export async function getPendingSyncPayload(): Promise<{
  sets: VocabSet[];
  tombstones: SetTombstone[];
  entries: SyncQueueEntry[];
}> {
  const db = await getSetDb();
  const entries = await db.getAll('syncQueue');
  const sets: VocabSet[] = [];
  const tombstones: SetTombstone[] = [];
  for (const entry of entries) {
    if (entry.kind === 'set') {
      const set = await db.get('sets', entry.id);
      if (set) sets.push(set);
    } else {
      const deleted = await db.get('tombstones', entry.id);
      if (deleted) tombstones.push(deleted);
    }
  }
  return { sets, tombstones, entries };
}

export async function acknowledgeSync(entries: SyncQueueEntry[]): Promise<void> {
  const db = await getSetDb();
  const tx = db.transaction('syncQueue', 'readwrite');
  for (const sent of entries) {
    const current = await tx.store.get(sent.id);
    if (
      current &&
      current.kind === sent.kind &&
      current.changedAt === sent.changedAt
    ) await tx.store.delete(sent.id);
  }
  await tx.done;
}

export async function getSyncCursor(): Promise<number> {
  return (await (await getSetDb()).get('syncState', 'serverCursor'))?.value ?? 0;
}

export async function setSyncCursor(value: number): Promise<void> {
  await (await getSetDb()).put('syncState', { key: 'serverCursor', value });
}
