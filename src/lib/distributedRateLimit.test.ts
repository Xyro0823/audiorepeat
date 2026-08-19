import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ data: undefined as { windowStart?: number; count?: number } | undefined, set: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/firebase/admin', () => ({
  getAdminDb: () => ({
    doc: (path: string) => ({ path }),
    runTransaction: async (fn: (tx: { get: () => Promise<{ data: () => typeof h.data }>; set: typeof h.set }) => Promise<unknown>) =>
      fn({ get: async () => ({ data: () => h.data }), set: h.set }),
  }),
}));

import { consumeDistributedRateLimit, rateLimitClientKey } from './distributedRateLimit';

beforeEach(() => { h.data = undefined; h.set.mockClear(); });

describe('distributed rate limit', () => {
  it('creates and increments a shared fixed-window counter', async () => {
    expect(await consumeDistributedRateLimit({ key: 'uid-1', limit: 2, windowMs: 1000, now: 100 })).toBe('allowed');
    expect(h.set).toHaveBeenCalledWith(expect.anything(), { windowStart: 100, count: 1, expiresAt: 1100 });
    h.data = { windowStart: 100, count: 1 };
    expect(await consumeDistributedRateLimit({ key: 'uid-1', limit: 2, windowMs: 1000, now: 200 })).toBe('allowed');
  });

  it('rejects exhausted windows and extracts the platform client address', async () => {
    h.data = { windowStart: 100, count: 2 };
    expect(await consumeDistributedRateLimit({ key: 'uid-1', limit: 2, windowMs: 1000, now: 200 })).toBe('limited');
    expect(rateLimitClientKey(new Request('https://app', { headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' } }), 'fallback')).toBe('1.2.3.4');
  });
});
