import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ consume: vi.fn(), set: vi.fn() }));
vi.mock('@/lib/firebase/admin', () => ({
  isAdminConfigured: () => true,
  getAdminDb: () => ({ doc: (path: string) => ({ path, set: h.set }) }),
}));
vi.mock('@/lib/distributedRateLimit', () => ({
  consumeDistributedRateLimit: h.consume,
  rateLimitClientKey: (_request: Request, fallback: string) => fallback,
}));
vi.mock('firebase-admin/firestore', () => ({ Timestamp: { now: () => 'now' } }));

import { POST } from './route';

const request = (body: unknown) => new Request('https://audiorepeat.app/api/newsletter', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});

beforeEach(() => {
  vi.clearAllMocks();
  h.consume.mockResolvedValue('allowed');
  h.set.mockResolvedValue(undefined);
});

describe('POST /api/newsletter', () => {
  it('validates and normalizes email before writing', async () => {
    expect((await POST(request({ email: 'not-an-email' }))).status).toBe(400);
    const response = await POST(request({ email: ' User@Example.COM ' }));
    expect(response.status).toBe(200);
    expect(h.set).toHaveBeenCalledWith(expect.objectContaining({ email: 'user@example.com' }), { merge: true });
  });

  it('rejects a limited address without writing', async () => {
    h.consume.mockResolvedValue('limited');
    expect((await POST(request({ email: 'user@example.com' }))).status).toBe(429);
    expect(h.set).not.toHaveBeenCalled();
  });
});
