import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Learning-progress extension of POST /api/sync: an optional `progress`
 * snapshot rides the authenticated library round trip and is merged
 * transactionally into the account's single progress doc. Identity is the
 * verified token uid only; schema/quota violations are rejected before any
 * Firestore access.
 */

const h = vi.hoisted(() => {
  const progressDoc = { exists: false, data: () => undefined as unknown };
  const tx = {
    get: vi.fn(async (ref: { __kind?: string }) => {
      if (ref.__kind === 'progress') return progressDoc;
      return { exists: false, size: 0, docs: [] as unknown[] };
    }),
    set: vi.fn(),
  };
  const db = {
    doc: vi.fn((path: string) => ({
      __kind: path.endsWith('/sync/progress') ? 'progress' : 'library',
    })),
    collection: vi.fn(() => ({
      doc: vi.fn(() => ({})),
      where: vi.fn(() => ({ get: async () => ({ docs: [] }) })),
      get: async () => ({ docs: [], size: 0 }),
    })),
    runTransaction: vi.fn(async (fn: (t: typeof tx) => Promise<void>) => fn(tx)),
  };
  return { configured: true, verify: vi.fn(), rate: vi.fn(), db, tx, progressDoc };
});

vi.mock('@/lib/firebase/admin', () => ({
  isAdminConfigured: () => h.configured,
  verifyIdToken: h.verify,
  getAdminDb: () => h.db,
}));
vi.mock('@/lib/distributedRateLimit', () => ({ consumeDistributedRateLimit: h.rate }));

import { POST } from './route';

function request(body: unknown, token?: string): Request {
  return new Request('https://app.example/api/sync', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  h.configured = true;
  h.verify.mockReset().mockResolvedValue('uid-1');
  h.rate.mockReset().mockResolvedValue('allowed');
  h.progressDoc.exists = false;
  h.progressDoc.data = () => undefined;
  h.tx.set.mockClear();
});

const BASE = { sets: [], tombstones: [], since: 0 };

describe('POST /api/sync - learning progress', () => {
  it('rejects a malformed progress snapshot before any Firestore access', async () => {
    const res = await POST(request({ ...BASE, progress: { days: 'junk' } }, 'token'));
    expect(res.status).toBe(400);
    expect(h.db.runTransaction).not.toHaveBeenCalled();
  });

  it('merges valid progress transactionally and returns the merged truth', async () => {
    h.progressDoc.exists = true;
    h.progressDoc.data = () => ({
      days: { '2026-08-18': { w: 30, ms: 3000 } },
      bestScores: { 'set-1': 25 },
      resetAt: 0,
      syncedAt: 1,
    });
    const res = await POST(
      request(
        {
          ...BASE,
          progress: {
            days: { '2026-08-18': { w: 12, ms: 8000 }, '2026-08-19': { w: 5, ms: 500 } },
            bestScores: { 'set-1': 40 },
            resetAt: 0,
            replace: false,
          },
        },
        'token',
      ),
    );
    expect(res.status).toBe(200);
    const body = await res.json() as { progress?: { days: Record<string, unknown> } };
    expect(body.progress).toBeDefined();
    // Max-merge across devices: neither device's day is lost or doubled.
    expect(body.progress!.days['2026-08-18']).toMatchObject({ w: 30, ms: 8000 });
    expect(body.progress!.days['2026-08-19']).toMatchObject({ w: 5 });
    const written = h.tx.set.mock.calls.find(([ref]) => ref.__kind === 'progress');
    expect(written).toBeDefined();
  });

  it('replace semantics overwrite stored history (restore/reset flows)', async () => {
    h.progressDoc.exists = true;
    h.progressDoc.data = () => ({
      days: { '2026-01-01': { w: 999, ms: 9999 } },
      bestScores: {},
      resetAt: 0,
      syncedAt: 1,
    });
    const resetAt = Date.parse('2026-08-15T00:00:00Z');
    const res = await POST(
      request(
        {
          ...BASE,
          progress: {
            days: { '2026-08-19': { w: 2, ms: 200 } },
            bestScores: {},
            resetAt,
            replace: true,
          },
        },
        'token',
      ),
    );
    expect(res.status).toBe(200);
    const body = await res.json() as { progress?: { days: Record<string, unknown>; resetAt: number } };
    expect(Object.keys(body.progress!.days)).toEqual(['2026-08-19']);
    expect(body.progress!.resetAt).toBe(resetAt);
  });

  it('never touches a progress doc when none was sent', async () => {
    await POST(request(BASE, 'token'));
    const written = h.tx.set.mock.calls.filter(([ref]) => ref.__kind === 'progress');
    expect(written).toHaveLength(0);
  });

  it('scopes the write by the VERIFIED token uid, never client input', async () => {
    await POST(
      request(
        {
          ...BASE,
          uid: 'victim',
          progress: { days: {}, bestScores: {}, resetAt: 0, replace: false },
        },
        'token',
      ),
    );
    expect(h.db.doc).toHaveBeenCalledWith('users/uid-1/sync/progress');
  });
});
