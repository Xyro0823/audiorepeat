import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  acknowledgeSync,
  activateSetOwner,
  deleteSet,
  getAllSets,
  getPendingSyncPayload,
  getSetTombstones,
  getSyncCursor,
  mergeRemoteLibrary,
  putSet,
  setDatabaseNameForOwner,
  setSyncCursor,
} from './indexedDb';
import type { VocabSet } from '@/types/app';

function makeSet(id: string, updatedAt: number, name = id): VocabSet {
  return {
    id,
    name,
    lang: 'es-ES',
    nativeLang: 'en-US',
    words: [{ id: `${id}-w1`, target: 'hola', translation: 'hello' }],
    createdAt: 1,
    updatedAt,
  };
}

function wipeDb(name: string): Promise<void> {
  return new Promise((resolve) => {
    const req = indexedDB.deleteDatabase(name);
    req.onblocked = req.onerror = req.onsuccess = () => resolve();
  });
}

beforeEach(async () => {
  activateSetOwner(null);
  await Promise.all([
    wipeDb(setDatabaseNameForOwner('uid-test')),
    wipeDb(setDatabaseNameForOwner('uid-other')),
  ]);
  activateSetOwner('uid-test');
});

describe('dirty sync queue', () => {
  it('queues only changed sets and deletions, not the whole library', async () => {
    await putSet(makeSet('a', 10));
    await putSet(makeSet('b', 10));
    const pending = await getPendingSyncPayload();
    expect(pending.sets.map((set) => set.id).sort()).toEqual(['a', 'b']);

    await acknowledgeSync(pending.entries);
    await putSet(makeSet('a', 11));
    const next = await getPendingSyncPayload();
    expect(next.sets.map((set) => set.id)).toEqual(['a']);
  });

  it('keeps an entry queued when the set changed again while the request was in flight', async () => {
    await putSet(makeSet('a', 10));
    const sent = (await getPendingSyncPayload()).entries;
    await putSet(makeSet('a', 20));
    await acknowledgeSync(sent);
    const stillPending = await getPendingSyncPayload();
    expect(stillPending.sets.map((set) => set.id)).toEqual(['a']);
    expect(stillPending.sets[0].updatedAt).toBe(20);
  });

  it('queues deletions as tombstones and survives re-queueing idempotently', async () => {
    await putSet(makeSet('a', 10));
    await deleteSet('a', 100);
    await deleteSet('a', 50); // stale retry must not move the tombstone backwards
    const pending = await getPendingSyncPayload();
    expect(pending.tombstones).toEqual([{ id: 'a', deletedAt: 100 }]);
    await acknowledgeSync(pending.entries);
    expect((await getPendingSyncPayload()).tombstones).toEqual([]);
  });
});

describe('last-write-wins merge of remote changes', () => {
  it('applies a newer remote edit but never overwrites a newer local edit', async () => {
    await putSet(makeSet('a', 10));
    await mergeRemoteLibrary([makeSet('a', 20)], []);
    expect((await getAllSets())[0].updatedAt).toBe(20);

    await putSet(makeSet('a', 30));
    await mergeRemoteLibrary([makeSet('a', 25)], []);
    expect((await getAllSets())[0].updatedAt).toBe(30);
  });

  it('does not resurrect a set the user deleted after the server copy was made', async () => {
    await putSet(makeSet('a', 10));
    await deleteSet('a', 100);
    await mergeRemoteLibrary([makeSet('a', 20)], []);
    expect(await getAllSets()).toEqual([]);
    expect(await getSetTombstones()).toEqual([{ id: 'a', deletedAt: 100 }]);

    // A re-download of the same stale copy (interrupted retry) stays deleted.
    await mergeRemoteLibrary([makeSet('a', 20)], []);
    expect(await getAllSets()).toEqual([]);
  });

  it('propagates a remote tombstone over a stale local copy but keeps a newer local edit', async () => {
    await putSet(makeSet('a', 30));
    await mergeRemoteLibrary([], [{ id: 'a', deletedAt: 20 }]);
    expect((await getAllSets()).map((set) => set.id)).toEqual(['a']);

    await mergeRemoteLibrary([], [{ id: 'a', deletedAt: 40 }]);
    expect(await getAllSets()).toEqual([]);
    expect(await getSetTombstones()).toEqual([{ id: 'a', deletedAt: 40 }]);
  });

  it('is idempotent when the same remote state is merged twice', async () => {
    await putSet(makeSet('old', 5));
    const first = await mergeRemoteLibrary([makeSet('a', 10)], []);
    const second = await mergeRemoteLibrary([makeSet('a', 10)], []);
    expect(second).toEqual(first);
  });
});

describe('account isolation', () => {
  it('never shows one uid library to another uid on the same device', async () => {
    await putSet(makeSet('user-a-set', 10));
    activateSetOwner('uid-other');
    expect(await getAllSets()).toEqual([]);
    await putSet(makeSet('user-b-set', 10));

    activateSetOwner('uid-test');
    const sets = await getAllSets();
    expect(sets.map((set) => set.id)).toEqual(['user-a-set']);
  });

  it('merges a late sync response into its captured owner, never the active owner', async () => {
    await putSet(makeSet('user-a-set', 10));
    activateSetOwner('uid-other');
    await putSet(makeSet('user-b-set', 10));

    // Simulates a User A request completing after the browser switched to
    // User B. The sync client passes its captured uid explicitly.
    await mergeRemoteLibrary([makeSet('remote-a-set', 20)], [], 'uid-test');

    expect((await getAllSets()).map((set) => set.id)).toEqual(['user-b-set']);
    expect((await getAllSets('uid-test')).map((set) => set.id).sort())
      .toEqual(['remote-a-set', 'user-a-set']);
  });
});

describe('sync cursor', () => {
  it('starts at zero and persists the server cursor across reads', async () => {
    expect(await getSyncCursor()).toBe(0);
    await setSyncCursor(1_234);
    expect(await getSyncCursor()).toBe(1_234);
  });
});
