import { Timestamp } from 'firebase-admin/firestore';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  verifyAdminRequest: vi.fn(),
  get: vi.fn(),
}));

const chain = {
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  get: h.get,
};
chain.where.mockReturnValue(chain);
chain.orderBy.mockReturnValue(chain);
chain.limit.mockReturnValue(chain);

vi.mock('@/lib/firebase/admin', () => ({
  verifyAdminRequest: h.verifyAdminRequest,
  getAdminDb: () => ({ collection: () => chain }),
}));

import { GET } from '@/app/api/admin/diagnostics/errors/route';

function adminRequest(token?: string): Request {
  const headers = new Headers();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return new Request('https://audiorepeat.app/api/admin/diagnostics/errors', { headers });
}

function doc(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    data: () => ({
      source: 'window',
      area: 'player',
      errorName: 'TypeError',
      online: true,
      visibility: 'visible',
      fingerprint: '1234567890abcdef12345678',
      release: 'abcdef123456',
      createdAt: Timestamp.fromMillis(Date.UTC(2026, 7, 20)),
      ...overrides,
    }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  chain.where.mockReturnValue(chain);
  chain.orderBy.mockReturnValue(chain);
  chain.limit.mockReturnValue(chain);
});

describe('GET /api/admin/diagnostics/errors', () => {
  it.each([
    [401, 'unauthenticated'],
    [403, 'forbidden'],
    [503, 'auth-server-not-configured'],
  ])('enforces the admin allowlist with status %s', async (status, error) => {
    h.verifyAdminRequest.mockResolvedValue({ ok: false, status, error });
    const response = await GET(adminRequest());
    expect(response.status).toBe(status);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(h.get).not.toHaveBeenCalled();
  });

  it('returns only sanitized, aggregate admin diagnostics', async () => {
    h.verifyAdminRequest.mockResolvedValue({ ok: true, adminUid: 'admin-secret-uid' });
    h.get.mockResolvedValue({
      size: 2,
      docs: [doc('one'), doc('two', { area: 'review', online: false, message: 'must not escape' })],
    });
    const response = await GET(adminRequest('admin-token'));
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).not.toMatch(/message|must not escape|admin-secret-uid|admin-token|stack|email|ip/i);
    const data = JSON.parse(text) as { summary: { total: number; offline: number; latest: unknown[] } };
    expect(data.summary.total).toBe(2);
    expect(data.summary.offline).toBe(1);
    expect(data.summary.latest).toHaveLength(2);
  });

  it('drops malformed stored rows instead of echoing arbitrary Firestore data', async () => {
    h.verifyAdminRequest.mockResolvedValue({ ok: true, adminUid: 'admin' });
    h.get.mockResolvedValue({
      size: 2,
      docs: [doc('safe'), doc('unsafe', { errorName: 'private content', token: 'secret' })],
    });
    const response = await GET(adminRequest('token'));
    const data = (await response.json()) as { summary: { total: number } };
    expect(data.summary.total).toBe(1);
  });

  it('returns a bounded no-store error when Firestore fails', async () => {
    h.verifyAdminRequest.mockResolvedValue({ ok: true, adminUid: 'admin' });
    h.get.mockRejectedValue(new Error('database details'));
    const response = await GET(adminRequest('token'));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'diagnostics-unavailable' });
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });
});
