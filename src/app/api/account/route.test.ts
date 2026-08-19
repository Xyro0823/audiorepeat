import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  verifyIdToken: vi.fn(), getUser: vi.fn(), deleteUser: vi.fn(), commit: vi.fn(),
  entitlementGet: vi.fn(), queryGet: vi.fn(), batchDelete: vi.fn(), batchSet: vi.fn(),
}));

vi.mock('@/lib/firebase/admin', () => ({
  isAdminConfigured: () => true,
  verifyIdToken: h.verifyIdToken,
  getAdminAuth: () => ({ getUser: h.getUser, deleteUser: h.deleteUser }),
  getAdminDb: () => ({
    doc: (path: string) => ({ path, get: h.entitlementGet }),
    collection: () => ({ where: () => ({ get: h.queryGet }) }),
    batch: () => ({ delete: h.batchDelete, set: h.batchSet, commit: h.commit }),
  }),
}));

import { DELETE } from './route';

const request = (token?: string) => new Request('https://audiorepeat.app/api/account', {
  method: 'DELETE', headers: token ? { Authorization: `Bearer ${token}` } : {},
});

beforeEach(() => {
  vi.clearAllMocks();
  h.verifyIdToken.mockResolvedValue('uid-1');
  h.getUser.mockResolvedValue({ email: 'USER@example.com' });
  h.queryGet.mockResolvedValue({ docs: [] });
  h.commit.mockResolvedValue(undefined);
  h.deleteUser.mockResolvedValue(undefined);
  h.entitlementGet.mockResolvedValue({ exists: true, data: () => ({ status: 'canceled' }) });
});

describe('DELETE /api/account', () => {
  it('requires a verified Firebase token', async () => {
    expect((await DELETE(request())).status).toBe(401);
  });

  it('blocks deletion while a paid subscription remains active', async () => {
    h.entitlementGet.mockResolvedValue({ data: () => ({ status: 'active', paddleSubscriptionId: 'sub-1' }) });
    const response = await DELETE(request('token'));
    expect(response.status).toBe(409);
    expect(h.commit).not.toHaveBeenCalled();
    expect(h.deleteUser).not.toHaveBeenCalled();
  });

  it('removes linked records before deleting Firebase Auth', async () => {
    const response = await DELETE(request('token'));
    expect(response.status).toBe(200);
    expect(h.commit).toHaveBeenCalledTimes(1);
    expect(h.deleteUser).toHaveBeenCalledWith('uid-1');
    expect(h.commit.mock.invocationCallOrder[0]).toBeLessThan(h.deleteUser.mock.invocationCallOrder[0]);
  });

  it('restores deleted records if Firebase Auth deletion fails', async () => {
    h.deleteUser.mockRejectedValue(new Error('auth backend unavailable'));
    const response = await DELETE(request('token'));
    expect(response.status).toBe(500);
    expect(h.commit).toHaveBeenCalledTimes(2);
    expect(h.batchSet).toHaveBeenCalled();
  });
});
