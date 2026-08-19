import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => {
  const verifyIdToken = vi.fn();
  return { verifyIdToken };
});

vi.mock('firebase-admin/app', () => ({
  cert: (c: unknown) => c,
  getApps: () => [{ name: 'test-app' }],
  initializeApp: vi.fn(),
}));

vi.mock('firebase-admin/auth', () => ({
  getAuth: () => ({ verifyIdToken: h.verifyIdToken }),
}));

vi.mock('firebase-admin/firestore', () => ({
  getFirestore: vi.fn(),
  Timestamp: {},
}));

import { isAdminUid, verifyAdminRequest } from '@/lib/firebase/admin';

function adminRequest(token?: string): Request {
  const headers = new Headers();
  if (token !== undefined) headers.set('Authorization', `Bearer ${token}`);
  return new Request('https://audiorepeat.vercel.app/api/admin/entitlements/grant', {
    method: 'POST',
    headers,
    body: '{}',
  });
}

beforeEach(() => {
  vi.stubEnv('FIREBASE_SERVICE_ACCOUNT', '{"type":"service_account"}');
  vi.stubEnv('ADMIN_UIDS', 'admin-1, admin-2');
  h.verifyIdToken.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('isAdminUid', () => {
  it('accepts allowlisted uids (trimmed, comma-separated)', () => {
    expect(isAdminUid('admin-1')).toBe(true);
    expect(isAdminUid('admin-2')).toBe(true);
  });

  it('rejects anything not on the allowlist', () => {
    expect(isAdminUid('user-1')).toBe(false);
    expect(isAdminUid('')).toBe(false);
    expect(isAdminUid('admin-1 ')).toBe(false); // not trimmed by the caller
  });

  it('denies everyone when ADMIN_UIDS is empty/unset', () => {
    vi.stubEnv('ADMIN_UIDS', '');
    expect(isAdminUid('admin-1')).toBe(false);
  });
});

describe('verifyAdminRequest', () => {
  it('returns 503 when the admin layer is not configured', async () => {
    vi.stubEnv('FIREBASE_SERVICE_ACCOUNT', '');
    const result = await verifyAdminRequest(adminRequest('token'));
    expect(result).toEqual({ ok: false, status: 503, error: 'auth-server-not-configured' });
    expect(h.verifyIdToken).not.toHaveBeenCalled();
  });

  it('returns 401 when no token is present', async () => {
    const result = await verifyAdminRequest(adminRequest());
    expect(result).toEqual({ ok: false, status: 401, error: 'unauthenticated' });
  });

  it('returns 401 when the token is invalid/expired', async () => {
    h.verifyIdToken.mockResolvedValue(null);
    const result = await verifyAdminRequest(adminRequest('bad-token'));
    expect(result).toEqual({ ok: false, status: 401, error: 'unauthenticated' });
  });

  it('returns 403 for a valid token whose uid is NOT on the allowlist', async () => {
    h.verifyIdToken.mockResolvedValue({ uid: 'normal-user' } as never);
    const result = await verifyAdminRequest(adminRequest('valid-token'));
    expect(result).toEqual({ ok: false, status: 403, error: 'forbidden' });
  });

  it('returns the admin uid for an allowlisted caller', async () => {
    h.verifyIdToken.mockResolvedValue({ uid: 'admin-1' } as never);
    const result = await verifyAdminRequest(adminRequest('admin-token'));
    expect(result).toEqual({ ok: true, adminUid: 'admin-1' });
    expect(h.verifyIdToken).toHaveBeenCalledWith('admin-token', true);
  });
});
