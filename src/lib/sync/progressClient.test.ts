import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Client-side regression tests for learning-progress sync: the local
 * snapshot rides the existing library-sync round trip, merged responses are
 * stored ONLY into the signed-in account's keys, late responses after an
 * account switch are dropped, and unchanged merges stay silent so syncs can
 * never loop.
 */
const h = vi.hoisted(() => ({
  user: null as { id: string } | null,
}));

vi.mock('@/lib/authStore', () => ({
  getAuthSnapshot: () => ({ user: h.user, status: h.user ? 'signed-in' : 'guest' }),
}));

// Minimal localStorage (node environment) with the key shapes the app uses.
class FakeStorage {
  private map = new Map<string, string>();
  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.map.set(key, String(value));
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
  key(index: number): string | null {
    return [...this.map.keys()][index] ?? null;
  }
  get length(): number {
    return this.map.size;
  }
}

vi.stubGlobal('window', {
  localStorage: new FakeStorage(),
  setTimeout: (fn: () => void) => setTimeout(fn, 0) as unknown as number,
});
vi.stubGlobal('navigator', { onLine: true });

async function fresh() {
  vi.resetModules();
  return import('./progressClient');
}

beforeEach(() => {
  vi.stubGlobal('window', {
    localStorage: new FakeStorage(),
    setTimeout: (fn: () => void) => setTimeout(fn, 0) as unknown as number,
  });
});

function statsKey(uid: string | null): string {
  return uid ? `audiorepeat-stats-v1:${uid}` : 'audiorepeat-stats-v1';
}

describe('progress client sync', () => {
  it('builds a payload from the account-scoped local keys only', async () => {
    const mod = await fresh();
    window.localStorage.setItem(statsKey('user-a'), JSON.stringify({ '2026-08-19': { w: 7, ms: 700 } }));
    // SpeedChallenge's real on-disk shape is a JSON BestRecord.
    window.localStorage.setItem(
      'audiorepeat-challenge-best-v1:user-a:set-1',
      JSON.stringify({ best: 21, plays: 4 }),
    );
    // Another account's data must NOT leak into A's payload.
    window.localStorage.setItem(statsKey('user-b'), JSON.stringify({ '2026-08-19': { w: 99, ms: 990 } }));
    window.localStorage.setItem(
      'audiorepeat-challenge-best-v1:user-b:set-9',
      JSON.stringify({ best: 99, plays: 9 }),
    );
    // Guest records stay guest-local too.
    window.localStorage.setItem(
      'audiorepeat-challenge-best-v1:guest-set',
      JSON.stringify({ best: 3, plays: 1 }),
    );
    const payload = mod.buildProgressPayload('user-a');
    expect(payload).toMatchObject({ replace: false, resetAt: 0 });
    expect(Object.keys(payload!.days)).toEqual(['2026-08-19']);
    expect(payload!.bestScores).toEqual({ 'set-1': 21 });
    // Guests never produce a payload — their progress stays device-local.
    expect(mod.buildProgressPayload(null)).toBeNull();
  });

  it('reads legacy bare-number best scores but writes SpeedChallenge JSON', async () => {
    const mod = await fresh();
    window.localStorage.setItem('audiorepeat-challenge-best-v1:user-a:legacy', '12');
    expect(mod.buildProgressPayload('user-a')!.bestScores).toEqual({ legacy: 12 });
    h.user = { id: 'user-a' };
    const merged = { days: {}, bestScores: { legacy: 15, fresh: 2 }, resetAt: 0 };
    expect(mod.applyMergedProgress('user-a', merged)).not.toBeNull();
    const stored = JSON.parse(
      window.localStorage.getItem('audiorepeat-challenge-best-v1:user-a:fresh')!,
    ) as { best: number; plays: number };
    expect(stored).toEqual({ best: 2, plays: 0 });
  });

  it('applies a merged response into the signed-in account\'s keys', async () => {
    h.user = { id: 'user-a' };
    const mod = await fresh();
    window.localStorage.setItem(statsKey('user-a'), JSON.stringify({ '2026-08-18': { w: 4, ms: 400 } }));
    const merged = await import('./progress').then((m) =>
      m.mergeProgress(
        { days: { '2026-08-18': { w: 4, ms: 400 } }, bestScores: {}, resetAt: 0 },
        { days: { '2026-08-19': { w: 9, ms: 900 } }, bestScores: { 'set-1': 8 }, resetAt: 0 },
        Date.now(),
      ),
    );
    const applied = mod.applyMergedProgress('user-a', merged);
    expect(applied).not.toBeNull();
    const days = JSON.parse(window.localStorage.getItem(statsKey('user-a'))!) as Record<string, unknown>;
    expect(days['2026-08-18']).toBeDefined();
    expect(days['2026-08-19']).toBeDefined();
    expect(
      JSON.parse(window.localStorage.getItem('audiorepeat-challenge-best-v1:user-a:set-1')!),
    ).toEqual({ best: 8, plays: 0 });
  });

  it('preserves local play counts when merged scores are stored', async () => {
    h.user = { id: 'user-a' };
    const mod = await fresh();
    window.localStorage.setItem(
      'audiorepeat-challenge-best-v1:user-a:set-1',
      JSON.stringify({ best: 3, plays: 7 }),
    );
    const merged = { days: {}, bestScores: { 'set-1': 30 }, resetAt: 0 };
    mod.applyMergedProgress('user-a', merged);
    expect(
      JSON.parse(window.localStorage.getItem('audiorepeat-challenge-best-v1:user-a:set-1')!),
    ).toEqual({ best: 30, plays: 7 });
  });

  it('max-merges scores and keeps other accounts\' keys untouched', async () => {
    h.user = { id: 'user-a' };
    const mod = await fresh();
    window.localStorage.setItem(
      'audiorepeat-challenge-best-v1:user-a:set-1',
      JSON.stringify({ best: 40, plays: 1 }),
    );
    window.localStorage.setItem(
      'audiorepeat-challenge-best-v1:user-b:set-1',
      JSON.stringify({ best: 6, plays: 2 }),
    );
    // Remote lower than local → idempotent no-op (no sync loop).
    expect(mod.applyMergedProgress('user-a', { days: {}, bestScores: { 'set-1': 10 }, resetAt: 0 })).toBeNull();
    // Remote higher → stored as SpeedChallenge JSON; B's record untouched.
    const applied = mod.applyMergedProgress('user-a', { days: {}, bestScores: { 'set-1': 55 }, resetAt: 0 });
    expect(applied).not.toBeNull();
    expect(
      JSON.parse(window.localStorage.getItem('audiorepeat-challenge-best-v1:user-a:set-1')!),
    ).toEqual({ best: 55, plays: 1 });
    expect(window.localStorage.getItem('audiorepeat-challenge-best-v1:user-b:set-1')).toBe(
      JSON.stringify({ best: 6, plays: 2 }),
    );
  });

  it('drops a late response after an account switch (no cross-account leak)', async () => {
    h.user = { id: 'user-a' };
    const mod = await fresh();
    window.localStorage.setItem(statsKey('user-a'), JSON.stringify({ '2026-08-18': { w: 4, ms: 400 } }));
    const merged = await import('./progress').then((m) =>
      m.mergeProgress(
        { days: {}, bestScores: {}, resetAt: 0 },
        { days: { '2026-08-20': { w: 50, ms: 5000 } }, bestScores: {}, resetAt: 0 },
        Date.now(),
      ),
    );
    // The account switches before the response is applied…
    h.user = { id: 'user-b' };
    expect(mod.applyMergedProgress('user-a', merged)).toBeNull();
    // …so neither A's keys nor B's keys were written by the stale response.
    expect(window.localStorage.getItem(statsKey('user-a'))).toContain('2026-08-18');
    expect(window.localStorage.getItem(statsKey('user-b'))).toBeNull();
  });

  it('stays silent when the merge changes nothing (no sync loops)', async () => {
    h.user = { id: 'user-a' };
    const mod = await fresh();
    const days = { '2026-08-19': { w: 5, ms: 500 } };
    window.localStorage.setItem(statsKey('user-a'), JSON.stringify(days));
    const same = { days, bestScores: {}, resetAt: 0 };
    expect(mod.applyMergedProgress('user-a', same)).toBeNull();
  });

  it('rejects malformed server payloads', async () => {
    h.user = { id: 'user-a' };
    const mod = await fresh();
    expect(mod.applyMergedProgress('user-a', { days: 'junk' })).toBeNull();
    expect(mod.applyMergedProgress('user-a', undefined)).toBeNull();
  });
});
