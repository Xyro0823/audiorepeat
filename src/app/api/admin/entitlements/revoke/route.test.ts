import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EntitlementRecord } from '@/lib/stripe/entitlements';

const h = vi.hoisted(() => {
  const verifyAdminRequest = vi.fn();
  const records = new Map<string, EntitlementRecord>();
  const store = {
    records,
    async getEntitlement(uid: string) {
      return records.get(uid) ?? null;
    },
    async putEntitlement(uid: string, patch: Partial<EntitlementRecord>) {
      const cur = records.get(uid) ?? {
        uid,
        plan: 'basic',
        billing: null,
        stripeCustomerId: null,
        stripeSubscriptionId: null,
        stripePriceId: null,
        status: 'active',
        currentPeriodEnd: null,
        updatedAt: 0,
      };
      records.set(uid, { ...cur, ...patch, uid });
    },
  };
  return { verifyAdminRequest, store };
});

vi.mock('@/lib/firebase/admin', () => ({
  verifyAdminRequest: h.verifyAdminRequest,
  createEntitlementStore: () => h.store,
}));

import { POST } from '@/app/api/admin/entitlements/revoke/route';

function revokeRequest(body: unknown, token = 'admin-token'): Request {
  return new Request('https://audiorepeat.vercel.app/api/admin/entitlements/revoke', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
}

function allowAdmin(uid = 'admin-1') {
  h.verifyAdminRequest.mockResolvedValue({ ok: true, adminUid: uid });
}

beforeEach(() => {
  h.verifyAdminRequest.mockReset();
  h.store.records.clear();
  allowAdmin();
});

describe('POST /api/admin/entitlements/revoke — authorization', () => {
  it('rejects unauthenticated requests', async () => {
    h.verifyAdminRequest.mockResolvedValue({ ok: false, status: 401, error: 'unauthenticated' });
    const res = await POST(revokeRequest({ uid: 'friend-1' }));
    expect(res.status).toBe(401);
  });

  it('rejects non-admin users even with a spoofed target uid', async () => {
    h.verifyAdminRequest.mockResolvedValue({ ok: false, status: 403, error: 'forbidden' });
    const res = await POST(revokeRequest({ uid: 'victim' }));
    expect(res.status).toBe(403);
  });
});

describe('POST /api/admin/entitlements/revoke — behavior', () => {
  it('revokes an active manual grant, keeping the audit trail', async () => {
    const grantedAt = Math.floor(Date.now() / 1000) - 100;
    h.store.records.set('friend-1', {
      uid: 'friend-1',
      plan: 'basic',
      billing: null,
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      stripePriceId: null,
      status: 'active',
      currentPeriodEnd: null,
      updatedAt: 0,
      manual: {
        plan: 'pro',
        reason: 'tester',
        expiresAt: null,
        grantedAt,
        grantedBy: 'admin-1',
        revokedAt: null,
        revokedBy: null,
      },
    });

    const res = await POST(revokeRequest({ uid: 'friend-1' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, uid: 'friend-1', revoked: true });

    const manual = h.store.records.get('friend-1')?.manual;
    expect(manual?.revokedAt).not.toBeNull();
    expect(manual?.revokedBy).toBe('admin-1');
    // Original grant info is preserved for audit.
    expect(manual?.grantedAt).toBe(grantedAt);
    expect(manual?.plan).toBe('pro');
  });

  it('returns 404 when the user has no manual grant', async () => {
    h.store.records.set('friend-1', {
      uid: 'friend-1',
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
    });
    const res = await POST(revokeRequest({ uid: 'friend-1' }));
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ error: 'no-manual-grant' });
  });

  it('returns 404 when the manual grant is already revoked', async () => {
    const revokedAt = Math.floor(Date.now() / 1000) - 10;
    h.store.records.set('friend-1', {
      uid: 'friend-1',
      plan: 'basic',
      billing: null,
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      stripePriceId: null,
      status: 'active',
      currentPeriodEnd: null,
      updatedAt: 0,
      manual: {
        plan: 'pro',
        reason: null,
        expiresAt: null,
        grantedAt: revokedAt - 100,
        grantedBy: 'admin-1',
        revokedAt,
        revokedBy: 'admin-1',
      },
    });
    const res = await POST(revokeRequest({ uid: 'friend-1' }));
    expect(res.status).toBe(404);
  });

  it('rejects a missing uid', async () => {
    const res = await POST(revokeRequest({}));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: 'invalid-uid' });
  });

  it('rejects an unparseable body', async () => {
    const res = await POST(
      new Request('https://audiorepeat.vercel.app/api/admin/entitlements/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer t' },
        body: 'nope',
      }),
    );
    expect(res.status).toBe(400);
  });
});
