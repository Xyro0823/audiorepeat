import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ verify: vi.fn(), consume: vi.fn(), set: vi.fn(), get: vi.fn() }));
vi.mock('@/lib/firebase/admin', () => ({
  isAdminConfigured: () => true,
  verifyIdToken: h.verify,
  getAdminDb: () => ({
    doc: (path: string) => ({ path, set: h.set }),
    collection: () => ({ orderBy: () => ({ limit: () => ({ get: h.get }) }) }),
  }),
}));
vi.mock('@/lib/distributedRateLimit', () => ({ consumeDistributedRateLimit: h.consume }));
vi.mock('firebase-admin/firestore', () => ({ Timestamp: { now: () => 'now' } }));

import { GET, POST } from './route';

const request = (method: 'GET' | 'POST', body?: unknown, token = 'token') => new Request('https://app.test/api/leaderboard?week=2026-08-24', {
  method,
  headers: { ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  ...(method === 'POST' ? { body: JSON.stringify(body) } : {}),
});

beforeEach(() => {
  vi.clearAllMocks();
  h.verify.mockResolvedValue('verified-user');
  h.consume.mockResolvedValue('allowed');
  h.set.mockResolvedValue(undefined);
  h.get.mockResolvedValue({ docs: [{ id: 'verified-user', data: () => ({ displayName: 'Xyro', words: 18, ms: 5000 }) }] });
});

describe('global leaderboard API', () => {
  it('requires a verified Firebase identity for reads and writes', async () => {
    expect((await GET(request('GET', undefined, ''))).status).toBe(401);
    expect((await POST(request('POST', { week: '2026-08-24', displayName: 'Xyro', words: 1, ms: 1 }, ''))).status).toBe(401);
  });

  it('writes only the verified user document and rejects invalid daily totals', async () => {
    const response = await POST(request('POST', { week: '2026-08-24', displayName: 'Xyro', words: 18, ms: 5000, userId: 'attacker' }));
    expect(response.status).toBe(200);
    expect(h.set).toHaveBeenCalledWith(expect.objectContaining({ displayName: 'Xyro', words: 18, ms: 5000 }), { merge: true });
    expect((await POST(request('POST', { week: 'bad', displayName: 'Xyro', words: -1, ms: 0 }))).status).toBe(400);
  });

  it('returns only public fields and marks the verified caller', async () => {
    const response = await GET(request('GET'));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ entries: [{ rank: 1, displayName: 'Xyro', words: 18, ms: 5000, isYou: true }] });
  });
});
