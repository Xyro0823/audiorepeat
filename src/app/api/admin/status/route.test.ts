import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => {
  const verifyAdminRequest = vi.fn();
  return { verifyAdminRequest };
});

vi.mock('@/lib/firebase/admin', () => ({
  verifyAdminRequest: h.verifyAdminRequest,
}));

import { GET } from '@/app/api/admin/status/route';

function statusRequest(token?: string): Request {
  const headers = new Headers();
  if (token !== undefined) headers.set('Authorization', `Bearer ${token}`);
  return new Request('https://audiorepeat.vercel.app/api/admin/status', { headers });
}

beforeEach(() => {
  h.verifyAdminRequest.mockReset();
});

describe('GET /api/admin/status', () => {
  it('returns 401 for an unauthenticated request', async () => {
    h.verifyAdminRequest.mockResolvedValue({ ok: false, status: 401, error: 'unauthenticated' });
    const res = await GET(statusRequest());
    expect(res.status).toBe(401);
  });

  it('returns 403 for a valid token that is not on the allowlist', async () => {
    h.verifyAdminRequest.mockResolvedValue({ ok: false, status: 403, error: 'forbidden' });
    const res = await GET(statusRequest('user-token'));
    expect(res.status).toBe(403);
  });

  it('returns 503 when the admin layer is not configured', async () => {
    h.verifyAdminRequest.mockResolvedValue({
      ok: false,
      status: 503,
      error: 'auth-server-not-configured',
    });
    const res = await GET(statusRequest('token'));
    expect(res.status).toBe(503);
  });

  it('confirms an allowlisted admin', async () => {
    h.verifyAdminRequest.mockResolvedValue({ ok: true, adminUid: 'admin-1' });
    const res = await GET(statusRequest('admin-token'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, admin: true });
  });
});
