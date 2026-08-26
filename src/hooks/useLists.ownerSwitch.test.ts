import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(join(process.cwd(), 'src/hooks/useLists.ts'), 'utf8');

describe('useLists auth owner switching', () => {
  it('reloads the visible library when the signed-in account changes after mount', () => {
    const switchHandler = source.indexOf('const switchOwner = (next: string | null)');
    const firstObservation = source.indexOf('seenOwnerRef.current = next;');
    const ownerActivation = source.indexOf('activateSetOwner(next);', switchHandler);
    const localReload = source.indexOf('setSets(await getAllSets());', ownerActivation);
    const remoteSync = source.indexOf('setSets(await syncLibraryNow());', localReload);
    const subscribe = source.indexOf('const unsubscribe = subscribeAuth(onAuthChange)');

    expect(switchHandler).toBeGreaterThan(-1);
    expect(firstObservation).toBeGreaterThan(-1);
    expect(ownerActivation).toBeGreaterThan(switchHandler);
    expect(localReload).toBeGreaterThan(ownerActivation);
    expect(remoteSync).toBeGreaterThan(localReload);
    expect(subscribe).toBeGreaterThan(firstObservation);
  });

  it('switches only when the uid actually changes, never on every auth notification', () => {
    const guard = source.indexOf('if (next === seenOwnerRef.current) return;');
    const switchCall = source.indexOf('switchOwner(next);');
    expect(guard).toBeGreaterThan(-1);
    expect(switchCall).toBeGreaterThan(guard);
  });

  it('stops an initial hydration if another account signs in before it finishes', () => {
    const ownerGuard = source.indexOf('const isCurrentOwner = () =>');
    const postSyncGuard = source.indexOf('if (!alive || !isCurrentOwner()) return;', ownerGuard);
    const settingsHydration = source.indexOf('await hydrateSettings();', postSyncGuard);

    expect(ownerGuard).toBeGreaterThan(-1);
    expect(postSyncGuard).toBeGreaterThan(ownerGuard);
    expect(settingsHydration).toBeGreaterThan(postSyncGuard);
  });

  it('refreshes the visible library after a cloud sync without scheduling another sync', () => {
    const listener = source.indexOf(
      "window.addEventListener('audiorepeat:library-synced', reload);",
    );
    // The effect's reload callback is declared just above the listener line.
    const effectBlock = source.slice(Math.max(0, listener - 400), listener + 200);
    const listenerReload = effectBlock.indexOf('getAllSets()');

    expect(listener).toBeGreaterThan(-1);
    expect(listenerReload).toBeGreaterThan(-1);
    // A scheduleLibrarySync here would loop with the sync that emitted the event.
    expect(effectBlock).not.toContain('scheduleLibrarySync');
  });
});
