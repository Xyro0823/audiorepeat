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

import { POST } from '@/app/api/admin/entitlements/grant/route';

function grantRequest(body: unknown, token = 'admin-token'): Request {
  return new Request('https://audiorepeat.vercel.app/api/admin/entitlements/grant', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
}

/** Default: the caller is an allowlisted admin. */
function allowAdmin(uid = 'admin-1') {
  h.verifyAdminRequest.mockResolvedValue({ ok: true, adminUid: uid });
}

beforeEach(() => {
  h.verifyAdminRequest.mockReset();
  h.store.records.clear();
  allowAdmin();
});

describe('POST /api/admin/entitlements/grant — authorization', () => {
  it('rejects unauthenticated requests', async () => {
    h.verifyAdminRequest.mockResolvedValue({ ok: false, status: 401, error: 'unauthenticated' });
    const res = await POST(grantRequest({ uid: 'friend-1', plan: 'pro' }));
    expect(res.status).toBe(401);
    expect(h.store.records.size).toBe(0);
  });

  it('rejects a normal authenticated user even when they try to grant themselves', async () => {
    // "normal-user" has a valid token but is not on the allowlist.
    h.verifyAdminRequest.mockResolvedValue({ ok: false, status: 403, error: 'forbidden' });
    const res = await POST(grantRequest({ uid: 'normal-user', plan: 'pro' }));
    expect(res.status).toBe(403);
    expect(h.store.records.size).toBe(0);
  });

  it('a spoofed recipient uid cannot bypass admin authorization', async () => {
    // The attacker is NOT an admin; the body uid (target) is irrelevant —
    // the request is still rejected before any write.
    h.verifyAdminRequest.mockResolvedValue({ ok: false, status: 403, error: 'forbidden' });
    const res = await POST(grantRequest({ uid: 'victim', plan: 'lifetime' }));
    expect(res.status).toBe(403);
    expect(h.store.records.size).toBe(0);
  });

  it('an allowlisted admin can grant Pro to any uid', async () => {
    const res = await POST(grantRequest({ uid: 'friend-1', plan: 'pro', reason: 'tester' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, uid: 'friend-1', plan: 'pro' });
    const rec = await h.store.getEntitlement('friend-1');
    expect(rec?.manual).toMatchObject({
      plan: 'pro',
      reason: 'tester',
      expiresAt: null,
      grantedBy: 'admin-1',
      revokedAt: null,
    });
    expect(typeof rec?.manual?.grantedAt).toBe('number');
  });

  it('an allowlisted admin can grant Lifetime with an expiry', async () => {
    const expiresAt = Math.floor(Date.now() / 1000) + 86_400;
    const res = await POST(grantRequest({ uid: 'friend-2', plan: 'lifetime', expiresAt }));
    expect(res.status).toBe(200);
    expect((await h.store.getEntitlement('friend-2'))?.manual).toMatchObject({
      plan: 'lifetime',
      expiresAt,
    });
  });

  it('granting again replaces the previous manual grant', async () => {
    await POST(grantRequest({ uid: 'friend-1', plan: 'pro' }));
    await POST(grantRequest({ uid: 'friend-1', plan: 'lifetime', reason: 'upgraded' }));
    expect((await h.store.getEntitlement('friend-1'))?.manual).toMatchObject({
      plan: 'lifetime',
      reason: 'upgraded',
    });
  });
});

describe('POST /api/admin/entitlements/grant — payload validation', () => {
  it('rejects a missing uid', async () => {
    const res = await POST(grantRequest({ plan: 'pro' }));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: 'invalid-uid' });
  });

  it('rejects an invalid plan', async () => {
    const res = await POST(grantRequest({ uid: 'u', plan: 'basic' }));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: 'invalid-plan' });
  });

  it('rejects a non-numeric expiry', async () => {
    const res = await POST(grantRequest({ uid: 'u', plan: 'pro', expiresAt: 'tomorrow' }));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: 'invalid-expiry' });
  });

  it('rejects an already-past expiry', async () => {
    const res = await POST(
      grantRequest({ uid: 'u', plan: 'pro', expiresAt: Math.floor(Date.now() / 1000) - 1 }),
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: 'invalid-expiry' });
  });

  it('rejects an over-long reason', async () => {
    const res = await POST(grantRequest({ uid: 'u', plan: 'pro', reason: 'x'.repeat(201) }));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: 'invalid-reason' });
  });

  it('rejects an unparseable body', async () => {
    const res = await POST(
      new Request('https://audiorepeat.vercel.app/api/admin/entitlements/grant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer t' },
        body: '{not json',
      }),
    );
    expect(res.status).toBe(400);
    expect(h.store.records.size).toBe(0);
  });
});
