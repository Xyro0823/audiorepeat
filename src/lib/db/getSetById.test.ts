import { describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import {
  activateSetOwner,
  deleteSet,
  getDeletedSetIds,
  getSetById,
  putSet,
} from './indexedDb';
import type { VocabSet } from '@/types/app';

function makeSet(id: string, updatedAt = 1): VocabSet {
  return {
    id,
    name: `Set ${id}`,
    lang: 'es-ES',
    words: [{ id: `${id}-w1`, target: 'hola', translation: 'hello' }],
    createdAt: 1,
    updatedAt,
  } as unknown as VocabSet;
}

describe('getSetById (targeted player read)', () => {
  it('returns only the requested set without touching other records', async () => {
    activateSetOwner(null);
    await putSet(makeSet('a'));
    await putSet(makeSet('b'));
    const found = await getSetById('b');
    expect(found?.id).toBe('b');
    expect(await getSetById('missing')).toBeNull();
  });

  it('is scoped to the active owner database', async () => {
    activateSetOwner(null);
    await putSet(makeSet('guest-only'));
    activateSetOwner(null); // idempotent re-activation
    expect((await getSetById('guest-only'))?.id).toBe('guest-only');
    activateSetOwner('uid-player');
    // Different owner database: the guest record is invisible here.
    expect(await getSetById('guest-only')).toBeNull();
    await putSet(makeSet('user-set'));
    expect((await getSetById('user-set'))?.id).toBe('user-set');
    activateSetOwner(null);
    expect(await getSetById('user-set')).toBeNull();
    // cleanup for the next case
    activateSetOwner('uid-player');
    await putSet(makeSet('doomed'));
  });

  it('deleted sets disappear from reads and appear in tombstones', async () => {
    activateSetOwner(null);
    await putSet(makeSet('doomed'));
    await deleteSet('doomed');
    expect(await getSetById('doomed')).toBeNull();
    expect((await getDeletedSetIds()).has('doomed')).toBe(true);
  });
});
