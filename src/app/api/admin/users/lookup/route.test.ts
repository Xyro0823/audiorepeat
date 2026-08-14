import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EntitlementRecord } from '@/lib/stripe/entitlements';

const h = vi.hoisted(() => {
  const verifyAdminRequest = vi.fn();
  const getUserByEmail = vi.fn();
  const getUser = vi.fn();
  const records = new Map<string, EntitlementRecord>();
  const store = {
    records,
    async getEntitlement(uid: string) {
      return records.get(uid) ?? null;
    },
    async putEntitlement(uid: string, patch: Partial<EntitlementRecord>) {
      records.set(uid, { ...(records.get(uid) ?? {}), ...patch, uid } as EntitlementRecord);
    },
  };
  return { verifyAdminRequest, getUserByEmail, getUser, store };
});

vi.mock('@/lib/firebase/admin', () => ({
  verifyAdminRequest: h.verifyAdminRequest,
  getAdminAuth: () => ({
    getUserByEmail: h.getUserByEmail,
    getUser: h.getUser,
  }),
  createEntitlementStore: () => h.store,
}));

import { GET } from '@/app/api/admin/users/lookup/route';

function lookupRequest(query: string, token = 'admin-token'): Request {
  return new Request(`https://audiorepeat.vercel.app/api/admin/users/lookup?${query}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

function fakeFirebaseUser(overrides: Partial<{ uid: string; email: string; displayName: string; photoURL: string }> = {}) {
  return {
    uid: 'target-uid-1',
    email: 'friend@example.com',
    displayName: 'Friend',
    photoURL: 'https://example.com/photo.png',
    ...overrides,
  };
}

const NOT_FOUND = Object.assign(new Error('not found'), { code: 'auth/user-not-found' });

beforeEach(() => {
  h.verifyAdminRequest.mockReset();
  h.getUserByEmail.mockReset();
  h.getUser.mockReset();
  h.store.records.clear();
  h.verifyAdminRequest.mockResolvedValue({ ok: true, adminUid: 'admin-1' });
});

describe('GET /api/admin/users/lookup — authorization', () => {
  it('rejects unauthenticated requests', async () => {
    h.verifyAdminRequest.mockResolvedValue({ ok: false, status: 401, error: 'unauthenticated' });
    const res = await GET(lookupRequest('email=friend@example.com'));
    expect(res.status).toBe(401);
    expect(h.getUserByEmail).not.toHaveBeenCalled();
  });

  it('rejects non-admin users', async () => {
    h.verifyAdminRequest.mockResolvedValue({ ok: false, status: 403, error: 'forbidden' });
    const res = await GET(lookupRequest('email=friend@example.com', 'normal-token'));
    expect(res.status).toBe(403);
    expect(h.getUserByEmail).not.toHaveBeenCalled();
  });
});

describe('GET /api/admin/users/lookup — behavior', () => {
  it('looks up a user by email and returns only minimal fields', async () => {
    h.getUserByEmail.mockResolvedValue(fakeFirebaseUser());
    const res = await GET(lookupRequest('email=Friend@Example.com'));
    expect(res.status).toBe(200);
    // Email lookup is server-side and case-insensitive normalized.
    expect(h.getUserByEmail).toHaveBeenCalledWith('friend@example.com');

    const body = await res.json();
    expect(body).toMatchObject({
      ok: true,
      user: {
        uid: 'target-uid-1',
        email: 'friend@example.com',
        displayName: 'Friend',
        photoURL: 'https://example.com/photo.png',
      },
    });
    // Never expose provider/credential data — only the minimal public fields.
    expect(Object.keys(body.user).sort()).toEqual(['displayName', 'email', 'photoURL', 'uid']);
    expect(JSON.stringify(body)).not.toContain('password');
    expect(JSON.stringify(body)).not.toContain('emailVerified');
    expect(JSON.stringify(body)).not.toContain('phoneNumber');
    expect(JSON.stringify(body)).not.toContain('customClaims');
  });

  it('looks up a user by uid', async () => {
    h.getUser.mockResolvedValue(fakeFirebaseUser());
    const res = await GET(lookupRequest('uid=target-uid-1'));
    expect(res.status).toBe(200);
    expect(h.getUser).toHaveBeenCalledWith('target-uid-1');
  });

  it('a non-admin target user can be looked up — the target never needs ADMIN_UIDS', async () => {
    h.getUserByEmail.mockResolvedValue(fakeFirebaseUser({ uid: 'ordinary-user' }));
    const res = await GET(lookupRequest('email=friend@example.com'));
    expect(res.status).toBe(200);
    expect((await res.json()).user.uid).toBe('ordinary-user');
  });

  it('returns a safe 404 for an unknown email', async () => {
    h.getUserByEmail.mockRejectedValue(NOT_FOUND);
    const res = await GET(lookupRequest('email=nobody@example.com'));
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ error: 'user-not-found' });
  });

  it('returns a safe 404 for an unknown uid', async () => {
    h.getUser.mockRejectedValue(NOT_FOUND);
    const res = await GET(lookupRequest('uid=does-not-exist'));
    expect(res.status).toBe(404);
  });

  it('rejects a query with neither email nor uid', async () => {
    const res = await GET(lookupRequest(''));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: 'invalid-query' });
  });

  it('rejects a query with both email and uid', async () => {
    const res = await GET(lookupRequest('email=a@b.co&uid=x'));
    expect(res.status).toBe(400);
  });

  it('rejects a malformed email', async () => {
    const res = await GET(lookupRequest('email=not-an-email'));
    expect(res.status).toBe(400);
  });

  it('includes the entitlement summary (plan, source, manual, provider plan)', async () => {
    h.getUserByEmail.mockResolvedValue(fakeFirebaseUser());
    h.store.records.set('target-uid-1', {
      uid: 'target-uid-1',
      plan: 'pro',
      billing: 'annual',
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      stripePriceId: null,
      paddleSubscriptionId: 'sub_1',
      paddlePriceId: 'pri_pro_annual',
      status: 'active',
      currentPeriodEnd: null,
      updatedAt: 0,
      manual: {
        plan: 'pro',
        reason: 'Friend gift',
        expiresAt: null,
        grantedAt: 1_800_000_000,
        grantedBy: 'admin-1',
        revokedAt: null,
        revokedBy: null,
      },
    });

    const res = await GET(lookupRequest('email=friend@example.com'));
    const body = await res.json();
    expect(body.entitlement).toMatchObject({
      plan: 'pro',
      source: 'manual',
      manual: { plan: 'pro', expiresAt: null, revoked: false },
      providerPlan: 'pro',
    });
  });
});
