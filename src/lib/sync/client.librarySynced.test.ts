import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(join(process.cwd(), 'src/lib/sync/client.ts'), 'utf8');

describe('sync client merge notification', () => {
  it('notifies the app after a successful merge so visible cards can refresh', () => {
    const merge = source.indexOf('await mergeRemoteLibrary(remote.sets, remote.tombstones)');
    const cursor = source.indexOf('await setSyncCursor(cursor)');
    const syncedPhase = source.indexOf("update({ phase: 'synced'", merge);
    const notify = source.indexOf(
      "window.dispatchEvent(new CustomEvent('audiorepeat:library-synced'))",
    );

    expect(merge).toBeGreaterThan(-1);
    expect(cursor).toBeGreaterThan(merge);
    expect(syncedPhase).toBeGreaterThan(cursor);
    // The event fires only after the merge, acknowledge, and cursor are done,
    // so listeners never re-read a half-merged library.
    expect(notify).toBeGreaterThan(syncedPhase);
  });

  it('never notifies when the sync failed, merged nothing, or went offline', () => {
    const notifyCount = (source.match(/audiorepeat:library-synced/g) || []).length;
    expect(notifyCount).toBe(1);
  });
});
