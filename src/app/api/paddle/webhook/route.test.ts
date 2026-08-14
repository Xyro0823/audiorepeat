import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EntitlementRecord } from '@/lib/stripe/entitlements';

/** Minimal in-memory store with a write counter to assert idempotency. */
function createInMemoryStore() {
  const records = new Map<string, EntitlementRecord>();
  const events = new Set<string>();
  const store = {
    records,
    events,
    entitlementWrites: 0,
    reset() {
      records.clear();
      events.clear();
      store.entitlementWrites = 0;
    },
    async getEntitlement(uid: string) {
      return records.get(uid) ?? null;
    },
    async putEntitlement(uid: string, patch: Partial<EntitlementRecord>) {
      store.entitlementWrites += 1;
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
    async findUidBySubscription(stripeSubscriptionId: string) {
      for (const [uid, r] of records) {
        if (r.stripeSubscriptionId === stripeSubscriptionId) return uid;
      }
      return null;
    },
    async findUidByPaddleSubscription(paddleSubscriptionId: string) {
      for (const [uid, r] of records) {
        if (r.paddleSubscriptionId === paddleSubscriptionId) return uid;
      }
      return null;
    },
    async isEventProcessed(eventId: string) {
      return events.has(eventId);
    },
    async markEventProcessed(eventId: string) {
      events.add(eventId);
    },
  };
  return store;
}

const h = vi.hoisted(() => {
  const store = createInMemoryStore();
  const unmarshal = vi.fn();
  const PRICES = {
    pri_pro_monthly: 'pro',
    pri_pro_annual: 'pro',
    pri_lifetime: 'lifetime',
  };
  const BILLING = { pri_pro_monthly: 'monthly', pri_pro_annual: 'annual' };
  const resolvePlanForPrice = (id: string | null | undefined) =>
    id ? (PRICES[id as keyof typeof PRICES] ?? null) : null;
  const resolveBillingForPrice = (id: string | null | undefined) =>
    id ? (BILLING[id as keyof typeof BILLING] ?? null) : null;
  return { store, unmarshal, resolvePlanForPrice, resolveBillingForPrice };
});

vi.mock('@/lib/firebase/admin', () => ({
  isAdminConfigured: () => true,
  createEntitlementStore: () => h.store,
}));

vi.mock('@/lib/paddle/server', () => ({
  getPaddle: () => ({ webhooks: { unmarshal: h.unmarshal } }),
  isPaddleConfigured: () => true,
  resolvePlanForPrice: h.resolvePlanForPrice,
  resolveBillingForPrice: h.resolveBillingForPrice,
}));

import { POST } from '@/app/api/paddle/webhook/route';

const SECRET = 'pdl_test_webhook_secret';

function eventPayload(eventType: string, data: unknown, eventId = `evt_${eventType}`) {
  return JSON.stringify({ eventId, eventType, data });
}

function webhookRequest(body: string, signature?: string): Request {
  const headers = new Headers();
  if (signature !== undefined) headers.set('paddle-signature', signature);
  return new Request('https://audiorepeat.vercel.app/api/paddle/webhook', {
    method: 'POST',
    headers,
    body,
  });
}

function completedProTransaction(overrides: Record<string, unknown> = {}) {
  return {
    id: 'txn_1',
    status: 'completed',
    customData: { uid: 'user-1', planId: 'pro', billing: 'annual' },
    items: [{ price: { id: 'pri_pro_annual' } }],
    subscriptionId: 'sub_1',
    ...overrides,
  };
}

function completedLifetimeTransaction(overrides: Record<string, unknown> = {}) {
  return {
    id: 'txn_life',
    status: 'completed',
    customData: { uid: 'user-2', planId: 'lifetime', billing: 'annual' },
    items: [{ price: { id: 'pri_lifetime' } }],
    subscriptionId: null,
    ...overrides,
  };
}

function subscription(status: string, overrides: Record<string, unknown> = {}) {
  return {
    id: 'sub_1',
    status,
    customData: { uid: 'user-1' },
    items: [{ price: { id: 'pri_pro_annual' } }],
    currentBillingPeriod: { endsAt: '2030-01-01T00:00:00Z' },
    ...overrides,
  };
}

beforeEach(() => {
  h.store.reset();
  h.unmarshal.mockReset();
  // Default: a "valid" signature parses the payload into the event shape the
  // route reads ({ eventId, eventType, data }); wrong secret throws.
  h.unmarshal.mockImplementation((rawBody: string, secret: string) => {
    if (secret !== SECRET) throw new Error('invalid signature');
    return JSON.parse(rawBody);
  });
  process.env.PADDLE_WEBHOOK_SECRET = SECRET;
});

describe('POST /api/paddle/webhook — signature verification', () => {
  it('rejects a request with no Paddle-Signature header', async () => {
    const res = await POST(webhookRequest(eventPayload('transaction.completed', {})));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: 'missing-signature' });
    expect(h.unmarshal).not.toHaveBeenCalled();
  });

  it('rejects a request with an invalid signature', async () => {
    h.unmarshal.mockImplementation(() => {
      throw new Error('invalid signature');
    });
    const res = await POST(
      webhookRequest(eventPayload('transaction.completed', {}), 'bad_sig'),
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: 'invalid-signature' });
  });

  it('returns 503 when the webhook secret is not configured', async () => {
    delete process.env.PADDLE_WEBHOOK_SECRET;
    const res = await POST(webhookRequest(eventPayload('transaction.completed', {}), 'sig'));
    expect(res.status).toBe(503);
    expect(h.unmarshal).not.toHaveBeenCalled();
  });
});

describe('POST /api/paddle/webhook — entitlement events', () => {
  it('grants Pro entitlement on transaction.completed', async () => {
    const res = await POST(
      webhookRequest(eventPayload('transaction.completed', completedProTransaction()), 'sig'),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ received: true });
    const rec = await h.store.getEntitlement('user-1');
    expect(rec).toMatchObject({
      plan: 'pro',
      billing: 'annual',
      paddleSubscriptionId: 'sub_1',
      paddlePriceId: 'pri_pro_annual',
      status: 'active',
    });
  });

  it('grants Lifetime on a completed lifetime purchase', async () => {
    const res = await POST(
      webhookRequest(eventPayload('transaction.completed', completedLifetimeTransaction()), 'sig'),
    );
    expect(res.status).toBe(200);
    expect(await h.store.getEntitlement('user-2')).toMatchObject({
      plan: 'lifetime',
      billing: 'lifetime',
      status: 'active',
    });
  });

  it('never grants on a transaction that has not completed', async () => {
    const res = await POST(
      webhookRequest(
        eventPayload('transaction.paid', completedProTransaction({ status: 'paid' })),
        'sig',
      ),
    );
    expect(res.status).toBe(200);
    expect(h.store.entitlementWrites).toBe(0);
  });

  it('keeps Pro entitled on subscription.activated while active/trialing', async () => {
    await POST(webhookRequest(eventPayload('transaction.completed', completedProTransaction()), 'sig'));
    const res = await POST(
      webhookRequest(
        eventPayload('subscription.activated', subscription('active', { currentBillingPeriod: { endsAt: '2030-06-01T00:00:00Z' } })),
        'sig',
      ),
    );
    expect(res.status).toBe(200);
    const rec = await h.store.getEntitlement('user-1');
    expect(rec).toMatchObject({ plan: 'pro', status: 'active' });
    expect(rec?.currentPeriodEnd).toBe(Math.floor(Date.parse('2030-06-01T00:00:00Z') / 1000));
  });

  it('revokes Pro on subscription.canceled and subscription.paused', async () => {
    await POST(webhookRequest(eventPayload('transaction.completed', completedProTransaction()), 'sig'));
    for (const eventType of ['subscription.canceled', 'subscription.paused']) {
      await POST(webhookRequest(eventPayload(eventType, subscription('canceled')), 'sig'));
      expect((await h.store.getEntitlement('user-1'))?.plan).toBe('basic');
    }
  });

  it('never grants on payment failure (subscription.past_due)', async () => {
    const res = await POST(
      webhookRequest(
        eventPayload('subscription.past_due', subscription('past_due', { customData: { uid: 'user-9' }, id: 'sub_new' })),
        'sig',
      ),
    );
    expect(res.status).toBe(200);
    expect(await h.store.getEntitlement('user-9')).toBeNull();
  });

  it('Lifetime cannot be downgraded by a later subscription cancel', async () => {
    await POST(webhookRequest(eventPayload('transaction.completed', completedLifetimeTransaction()), 'sig'));
    await POST(
      webhookRequest(
        eventPayload('subscription.canceled', subscription('canceled', { customData: { uid: 'user-2' } })),
        'sig',
      ),
    );
    const rec = await h.store.getEntitlement('user-2');
    expect(rec?.plan).toBe('lifetime');
    expect(rec?.status).toBe('active');
  });

  it('acknowledges unrelated event types without touching entitlement', async () => {
    const res = await POST(
      webhookRequest(eventPayload('customer.created', { id: 'ctm_1' }), 'sig'),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ received: true });
    expect(h.store.entitlementWrites).toBe(0);
    expect(h.store.events.size).toBe(0);
  });
});

describe('POST /api/paddle/webhook — caching', () => {
  it('returns Cache-Control: no-store on every response kind', async () => {
    // Missing signature (400)
    const missing = await POST(webhookRequest(eventPayload('transaction.completed', {})));
    expect(missing.status).toBe(400);
    expect(missing.headers.get('Cache-Control')).toBe('no-store');

    // Invalid signature (400)
    h.unmarshal.mockImplementation(() => {
      throw new Error('invalid signature');
    });
    const badSig = await POST(webhookRequest(eventPayload('transaction.completed', {}), 'sig'));
    expect(badSig.status).toBe(400);
    expect(badSig.headers.get('Cache-Control')).toBe('no-store');

    // Successful apply + duplicate acknowledgement (200)
    h.unmarshal.mockImplementation((rawBody: string, secret: string) => {
      if (secret !== SECRET) throw new Error('invalid signature');
      return JSON.parse(rawBody);
    });
    const ok = await POST(webhookRequest(eventPayload('transaction.completed', completedProTransaction()), 'sig'));
    expect(ok.status).toBe(200);
    expect(ok.headers.get('Cache-Control')).toBe('no-store');

    const dup = await POST(
      webhookRequest(eventPayload('transaction.completed', completedProTransaction(), 'evt_hdr'), 'sig'),
    );
    expect(dup.status).toBe(200);
    expect(dup.headers.get('Cache-Control')).toBe('no-store');

    // Webhook secret not configured (503)
    delete process.env.PADDLE_WEBHOOK_SECRET;
    const unconfigured = await POST(webhookRequest(eventPayload('transaction.completed', {}), 'sig'));
    expect(unconfigured.status).toBe(503);
    expect(unconfigured.headers.get('Cache-Control')).toBe('no-store');
  });
});

describe('POST /api/paddle/webhook — idempotency & retries', () => {
  it('is idempotent — a duplicate event is acknowledged without re-applying', async () => {
    const body = eventPayload('transaction.completed', completedProTransaction(), 'evt_dup');

    const first = await POST(webhookRequest(body, 'sig'));
    expect(first.status).toBe(200);
    expect(h.store.entitlementWrites).toBe(1);
    expect(h.store.events.has('evt_dup')).toBe(true);

    const second = await POST(webhookRequest(body, 'sig'));
    expect(second.status).toBe(200);
    expect(await second.json()).toEqual({ received: true, duplicate: true });
    expect(h.store.entitlementWrites).toBe(1);
  });

  it('does not mark an event processed when processing fails (retryable)', async () => {
    const body = eventPayload('transaction.completed', completedProTransaction(), 'evt_fail');
    // Signature verifies, but applying the entitlement throws.
    h.store.putEntitlement = async () => {
      throw new Error('firestore write failed');
    };

    const res = await POST(webhookRequest(body, 'sig'));
    expect(res.status).toBe(500);
    // The marker must NOT be written — Paddle will retry the same event.
    expect(h.store.events.has('evt_fail')).toBe(false);

    // Once the store recovers, the retried delivery succeeds and is applied.
    h.store.putEntitlement = async (uid: string, patch: Partial<EntitlementRecord>) => {
      h.store.entitlementWrites += 1;
      h.store.records.set(uid, { ...patch, uid } as EntitlementRecord);
    };
    const retry = await POST(webhookRequest(body, 'sig'));
    expect(retry.status).toBe(200);
    expect(h.store.entitlementWrites).toBe(1);
    expect(h.store.events.has('evt_fail')).toBe(true);
  });
});
