import { describe, expect, it } from 'vitest';
import {
  newerLibraryRecord,
  nextServerSyncCursor,
  sanitizeSyncPayload,
  sanitizeSyncSet,
  transitionLibraryQuota,
} from './librarySync';

const validSet = {
  id: 'set-1',
  name: 'Spanish',
  lang: 'es-ES',
  nativeLang: 'en-US',
  words: [{ id: 'w-1', target: 'hola', translation: 'hello' }],
  createdAt: 1,
  updatedAt: 2,
};

describe('library sync validation', () => {
  it('creates a strictly monotonic server cursor for concurrent sync rounds', () => {
    expect(nextServerSyncCursor(0, 100)).toBe(100);
    expect(nextServerSyncCursor(100, 100)).toBe(101);
    expect(nextServerSyncCursor(101, 99)).toBe(102);
  });

  it('accepts valid set content and FSRS progress', () => {
    const set = sanitizeSyncSet({
      ...validSet,
      words: [{
        ...validSet.words[0],
        mastery: 'mastered',
        review: {
          due: 9,
          stability: 1,
          difficulty: 2,
          elapsedDays: 0,
          scheduledDays: 1,
          learningSteps: 0,
          reps: 1,
          lapses: 0,
          state: 2,
        },
      }],
    });
    expect(set?.words[0].review?.due).toBe(9);
  });

  it('never accepts entitlement fields from per-set sync settings', () => {
    const set = sanitizeSyncSet({
      ...validSet,
      settings: { repeats: 3, speed: 0.8, plan: 'lifetime', hiddenLangs: ['secret'] },
    });
    expect(set?.settings).toMatchObject({ repeats: 3, speed: 0.8 });
    expect(set?.settings).not.toHaveProperty('plan');
    expect(set?.settings).not.toHaveProperty('hiddenLangs');
  });

  it('rejects malformed identifiers, empty words, and invalid tombstones', () => {
    expect(sanitizeSyncSet({ ...validSet, id: 'bad/id' })).toBeNull();
    expect(sanitizeSyncSet({ ...validSet, words: [] })).toBeNull();
    expect(sanitizeSyncPayload({ sets: [validSet], tombstones: [{ id: '../x', deletedAt: 3 }] }))
      .toBeNull();
    expect(sanitizeSyncPayload({ sets: [validSet], tombstones: [{ id: 'set-1', deletedAt: 3 }] }))
      .toBeNull();
  });

  it('uses last-write-wins timestamps for edits and deletions', () => {
    expect(newerLibraryRecord({ updatedAt: 10 }, { deletedAt: 11 })).toBe(true);
    expect(newerLibraryRecord({ deletedAt: 12 }, { updatedAt: 11 })).toBe(false);
    expect(newerLibraryRecord({ updatedAt: 10 }, { updatedAt: 10 })).toBe(false);
  });

  it('tracks active sets, tombstones, and word quota transitions', () => {
    const base = { activeCount: 1, wordCount: 10, recordCount: 1 };
    expect(transitionLibraryQuota(base, { kind: 'set', wordCount: 10 }, { kind: 'deleted' }))
      .toEqual({ activeCount: 0, wordCount: 0, recordCount: 1 });
    expect(transitionLibraryQuota(base, { kind: 'deleted' }, { kind: 'set', wordCount: 4 }))
      .toEqual({ activeCount: 2, wordCount: 14, recordCount: 1 });
    expect(transitionLibraryQuota(base, undefined, { kind: 'set', wordCount: 4 }))
      .toEqual({ activeCount: 2, wordCount: 14, recordCount: 2 });
  });
});
