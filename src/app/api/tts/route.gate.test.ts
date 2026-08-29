import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EntitlementRecord } from '@/lib/stripe/entitlements';

vi.mock('server-only', () => ({}));

const h = vi.hoisted(() => {
  const verifyIdToken = vi.fn();
  const getEntitlement = vi.fn();
  const synthesizeAzureSpeech = vi.fn();
  const consumeDistributedRateLimit = vi.fn();
  return { verifyIdToken, getEntitlement, synthesizeAzureSpeech, consumeDistributedRateLimit };
});

vi.mock('@/lib/firebase/admin', () => ({
  isAdminConfigured: () => true,
  verifyIdToken: h.verifyIdToken,
  createEntitlementStore: () => ({ getEntitlement: h.getEntitlement }),
}));

vi.mock('@/lib/tts/azureTts.server', () => ({
  isAzureTtsConfigured: () => true,
  synthesizeAzureSpeech: h.synthesizeAzureSpeech,
}));

vi.mock('@/lib/distributedRateLimit', () => ({
  consumeDistributedRateLimit: h.consumeDistributedRateLimit,
}));

import { POST } from '@/app/api/tts/route';

// Real-clock-relative "now" in seconds — the route computes entitlements
// against Date.now(), so expiries are expressed relative to it.
const nowSec = () => Math.floor(Date.now() / 1000);

function record(patch: Partial<EntitlementRecord>): EntitlementRecord {
  return {
    uid: 'uid-1',
    plan: 'basic',
    billing: null,
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    stripePriceId: null,
    status: 'canceled',
    currentPeriodEnd: null,
    updatedAt: null,
    ...patch,
  };
}

function ttsRequest(token?: string): Request {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (token !== undefined) headers.set('Authorization', `Bearer ${token}`);
  return new Request('https://audiorepeat.vercel.app/api/tts', {
    method: 'POST',
    headers,
    body: JSON.stringify({ text: 'hola', lang: 'es-ES' }),
  });
}

beforeEach(() => {
  h.verifyIdToken.mockReset().mockResolvedValue('uid-1');
  h.getEntitlement.mockReset().mockResolvedValue(null);
  h.synthesizeAzureSpeech.mockReset().mockResolvedValue({
    audio: new Uint8Array([1, 2, 3]),
    voice: 'es-ES-Standard',
  });
  h.consumeDistributedRateLimit.mockReset().mockResolvedValue('allowed');
});

describe('POST /api/tts — server-side cloud-audio entitlement', () => {
  it('rejects unauthenticated requests', async () => {
    const res = await POST(ttsRequest());
    expect(res.status).toBe(401);
  });

  it('allows a Free user (no entitlement record) within the capped fallback', async () => {
    h.getEntitlement.mockResolvedValue(null);
    const res = await POST(ttsRequest('free-token'));
    expect(res.status).toBe(200);
    expect(h.synthesizeAzureSpeech).toHaveBeenCalled();
  });

  it('allows a canceled Pro subscription on the capped Free fallback', async () => {
    h.getEntitlement.mockResolvedValue(
      record({ plan: 'basic', status: 'canceled', paddleSubscriptionId: 'sub_1' }),
    );
    const res = await POST(ttsRequest('canceled-token'));
    expect(res.status).toBe(200);
  });

  it('allows an expired manual gift on the capped Free fallback', async () => {
    h.getEntitlement.mockResolvedValue(
      record({
        manual: {
          plan: 'pro',
          reason: null,
          expiresAt: nowSec() - 10,
          grantedAt: nowSec() - 1000,
          grantedBy: null,
          revokedAt: null,
          revokedBy: null,
        },
      }),
    );
    const res = await POST(ttsRequest('expired-gift-token'));
    expect(res.status).toBe(200);
  });

  it('allows an active Pro subscription and synthesizes', async () => {
    h.getEntitlement.mockResolvedValue(
      record({ plan: 'pro', billing: 'monthly', status: 'active', paddleSubscriptionId: 'sub_1' }),
    );
    const res = await POST(ttsRequest('pro-token'));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('audio/mpeg');
  });

  it('allows a trialing Pro subscription', async () => {
    h.getEntitlement.mockResolvedValue(
      record({ plan: 'pro', status: 'trialing', stripeSubscriptionId: 'sub_2' }),
    );
    const res = await POST(ttsRequest('trial-token'));
    expect(res.status).toBe(200);
  });

  it('allows Lifetime (one-time purchase, no subscription)', async () => {
    h.getEntitlement.mockResolvedValue(record({ plan: 'lifetime', billing: 'lifetime', status: 'active' }));
    const res = await POST(ttsRequest('lifetime-token'));
    expect(res.status).toBe(200);
  });

  it('allows an active manual (gift) Pro grant', async () => {
    h.getEntitlement.mockResolvedValue(
      record({
        manual: {
          plan: 'pro',
          reason: 'Creator gift',
          expiresAt: nowSec() + 3600,
          grantedAt: nowSec() - 1000,
          grantedBy: null,
          revokedAt: null,
          revokedBy: null,
        },
      }),
    );
    const res = await POST(ttsRequest('gift-token'));
    expect(res.status).toBe(200);
  });
});
