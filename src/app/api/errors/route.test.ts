import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  isAdminConfigured: vi.fn(),
  verifyIdToken: vi.fn(),
  add: vi.fn(),
  consume: vi.fn(),
  rateKey: vi.fn(),
}));

vi.mock('@/lib/firebase/admin', () => ({
  isAdminConfigured: h.isAdminConfigured,
  verifyIdToken: h.verifyIdToken,
  getAdminDb: () => ({ collection: () => ({ add: h.add }) }),
}));

vi.mock('@/lib/distributedRateLimit', () => ({
  consumeDistributedRateLimit: h.consume,
  rateLimitClientKey: h.rateKey,
}));

import { POST } from '@/app/api/errors/route';

const report = {
  v: 1,
  source: 'window',
  area: 'player',
  errorName: 'TypeError',
  online: true,
  visibility: 'visible',
};

function request(body: unknown, options: { token?: string; origin?: string; ip?: string } = {}): Request {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (options.token !== undefined) headers.set('Authorization', options.token);
  if (options.origin !== undefined) headers.set('Origin', options.origin);
  if (options.ip !== undefined) headers.set('x-forwarded-for', options.ip);
  return new Request('https://audiorepeat.app/api/errors', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  h.isAdminConfigured.mockReturnValue(true);
  h.verifyIdToken.mockResolvedValue('verified-uid');
  h.consume.mockResolvedValue('allowed');
  h.rateKey.mockReturnValue('203.0.113.10');
  h.add.mockResolvedValue({ id: 'stored' });
});

describe('POST /api/errors', () => {
  it('fails closed when Firebase Admin is unavailable', async () => {
    h.isAdminConfigured.mockReturnValue(false);
    const response = await POST(request(report));
    expect(response.status).toBe(503);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(h.add).not.toHaveBeenCalled();
  });

  it('accepts a rate-limited guest report without persisting identity or content', async () => {
    const response = await POST(request(report, { ip: '203.0.113.10' }));
    expect(response.status).toBe(202);
    expect(h.rateKey).toHaveBeenCalled();
    expect(h.consume).toHaveBeenCalledWith(expect.objectContaining({
      key: 'client-errors:guest:203.0.113.10',
      limit: 8,
    }));
    const stored = h.add.mock.calls[0][0] as Record<string, unknown>;
    expect(stored).toMatchObject({
      source: 'window',
      area: 'player',
      errorName: 'TypeError',
      online: true,
      visibility: 'visible',
      release: 'local',
    });
    expect(stored.fingerprint).toMatch(/^[0-9a-f]{24}$/);
    expect(stored).toHaveProperty('createdAt');
    expect(stored).toHaveProperty('expiresAt');
    expect(JSON.stringify(stored)).not.toMatch(/uid|email|message|stack|token|203\.0\.113\.10/i);
  });

  it('verifies a supplied token and uses uid only in the transient limiter key', async () => {
    const response = await POST(request(report, { token: 'Bearer valid-token' }));
    expect(response.status).toBe(202);
    expect(h.verifyIdToken).toHaveBeenCalledWith('valid-token');
    expect(h.consume).toHaveBeenCalledWith(expect.objectContaining({
      key: 'client-errors:auth:verified-uid',
      limit: 30,
    }));
    expect(JSON.stringify(h.add.mock.calls[0][0])).not.toContain('verified-uid');
  });

  it('rejects invalid authorization instead of silently treating it as a guest', async () => {
    h.verifyIdToken.mockResolvedValue(null);
    const response = await POST(request(report, { token: 'Bearer invalid-token' }));
    expect(response.status).toBe(401);
    expect(h.consume).not.toHaveBeenCalled();
    expect(h.add).not.toHaveBeenCalled();
  });

  it('rejects cross-origin, sensitive extra fields and oversized bodies before storage', async () => {
    expect((await POST(request(report, { origin: 'https://attacker.example' }))).status).toBe(403);
    expect((await POST(request({ ...report, message: 'private word' }))).status).toBe(400);
    expect((await POST(request({ ...report, padding: 'x'.repeat(3_000) }))).status).toBe(413);
    expect(h.add).not.toHaveBeenCalled();
  });

  it('returns 429 without writing when the distributed limiter denies the report', async () => {
    h.consume.mockResolvedValue('limited');
    const response = await POST(request(report));
    expect(response.status).toBe(429);
    expect(h.add).not.toHaveBeenCalled();
  });

  it('fails closed when rate limiting or storage is unavailable', async () => {
    h.consume.mockRejectedValueOnce(new Error('limiter down'));
    expect((await POST(request(report))).status).toBe(503);
    h.consume.mockResolvedValueOnce('allowed');
    h.add.mockRejectedValueOnce(new Error('store down'));
    expect((await POST(request(report))).status).toBe(500);
  });
});
