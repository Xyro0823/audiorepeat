import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ verifyIdToken: vi.fn(), consume: vi.fn(), set: vi.fn() }));
vi.mock('@/lib/firebase/admin', () => ({
  isAdminConfigured: () => true,
  verifyIdToken: h.verifyIdToken,
  getAdminDb: () => ({ doc: (path: string) => ({ path, set: h.set }) }),
}));
vi.mock('@/lib/distributedRateLimit', () => ({ consumeDistributedRateLimit: h.consume }));
vi.mock('firebase-admin/firestore', () => ({ Timestamp: { now: () => 'now' } }));

import { POST } from './route';

const request = (body: unknown, token?: string) => new Request('https://audiorepeat.app/api/plan-interest', {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  body: JSON.stringify(body),
});

beforeEach(() => {
  vi.clearAllMocks();
  h.verifyIdToken.mockResolvedValue('verified-uid');
  h.consume.mockResolvedValue('allowed');
  h.set.mockResolvedValue(undefined);
});

describe('POST /api/plan-interest', () => {
  it('requires server-verified authentication', async () => {
    expect((await POST(request({ plan: 'pro', billing: 'annual' }))).status).toBe(401);
    expect(h.set).not.toHaveBeenCalled();
  });

  it('ignores spoofed identity and writes under the verified uid', async () => {
    const response = await POST(request({ plan: 'pro', billing: 'annual', userId: 'attacker-choice' }, 'token'));
    expect(response.status).toBe(200);
    expect(h.set).toHaveBeenCalledWith(expect.objectContaining({ userId: 'verified-uid' }), { merge: true });
  });

  it('rejects invalid plans and rate-limits repeated callers', async () => {
    expect((await POST(request({ plan: 'basic', billing: 'annual' }, 'token'))).status).toBe(400);
    h.consume.mockResolvedValue('limited');
    expect((await POST(request({ plan: 'pro', billing: 'annual' }, 'token'))).status).toBe(429);
  });
});
