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
    async isEventProcessed(eventId: string) {
      return events.has(eventId);
    },
    async markEventProcessed(eventId: string) {
      events.add(eventId);
    },
    async putProviderEntitlementIfNewer(
      uid: string,
      patch: Partial<EntitlementRecord>,
      provider: 'stripe' | 'paddle',
      occurredAtMs: number,
    ) {
      const current = records.get(uid);
      const field = provider === 'stripe' ? 'stripeEventAt' : 'paddleEventAt';
      const previous = current?.[field];
      if (typeof previous === 'number' && previous >= occurredAtMs) return false;
      await store.putEntitlement(uid, { ...patch, [field]: occurredAtMs });
      return true;
    },
  };
  return store;
}

const h = vi.hoisted(() => {
  const store = createInMemoryStore();
  const constructEvent = vi.fn();
  return { store, constructEvent };
});

vi.mock('@/lib/firebase/admin', () => ({
  isAdminConfigured: () => true,
  createEntitlementStore: () => h.store,
}));

vi.mock('@/lib/stripe/server', () => ({
  getStripe: () => ({ webhooks: { constructEvent: h.constructEvent } }),
  isStripeConfigured: () => true,
}));

import { POST } from '@/app/api/stripe/webhook/route';

const SECRET = 'whsec_test_secret';

let eventCreated = 100;
function eventPayload(type: string, object: unknown, id = `evt_${type}`, created = eventCreated++) {
  return JSON.stringify({ id, type, created, data: { object } });
}

function webhookRequest(body: string, signature?: string): Request {
  const headers = new Headers();
  if (signature !== undefined) headers.set('stripe-signature', signature);
  return new Request('https://audiorepeat.vercel.app/api/stripe/webhook', {
    method: 'POST',
    headers,
    body,
  });
}

beforeEach(() => {
  eventCreated = 100;
  h.store.reset();
  h.constructEvent.mockReset();
  // Default: verify the signature and parse the payload as the event.
  h.constructEvent.mockImplementation((rawBody: string, _sig: string, secret: string) => {
    if (secret !== SECRET) throw new Error('wrong secret');
    return JSON.parse(rawBody);
  });
  process.env.STRIPE_WEBHOOK_SECRET = SECRET;
});

describe('POST /api/stripe/webhook', () => {
  it('rejects a request with no Stripe-Signature header', async () => {
    const res = await POST(webhookRequest(eventPayload('checkout.session.completed', {})));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: 'missing-signature' });
    expect(h.constructEvent).not.toHaveBeenCalled();
  });

  it('rejects a request with an invalid signature', async () => {
    h.constructEvent.mockImplementation(() => {
      throw new Error('No signatures found matching the expected signature');
    });
    const res = await POST(webhookRequest(eventPayload('checkout.session.completed', {}), 'bad_sig'));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: 'invalid-signature' });
  });

  it('returns 503 when the webhook secret is not configured', async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    const res = await POST(webhookRequest(eventPayload('checkout.session.completed', {}), 'tsec_sig'));
    expect(res.status).toBe(503);
  });

  it('grants Pro entitlement on checkout.session.completed', async () => {
    const session = {
      id: 'cs_1',
      mode: 'subscription',
      payment_status: 'paid',
      customer: 'cus_1',
      subscription: 'sub_1',
      metadata: { uid: 'user-1', planId: 'pro', billing: 'annual' },
    };
    const res = await POST(
      webhookRequest(eventPayload('checkout.session.completed', session), 'tsec_sig'),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ received: true });
    const rec = await h.store.getEntitlement('user-1');
    expect(rec).toMatchObject({ plan: 'pro', billing: 'annual', stripeSubscriptionId: 'sub_1' });
  });

  it('is idempotent — a duplicate event is acknowledged without re-applying', async () => {
    const session = {
      id: 'cs_1',
      mode: 'subscription',
      payment_status: 'paid',
      customer: 'cus_1',
      subscription: 'sub_1',
      metadata: { uid: 'user-1', planId: 'pro', billing: 'annual' },
    };
    const body = eventPayload('checkout.session.completed', session, 'evt_dup');

    const first = await POST(webhookRequest(body, 'tsec_sig'));
    expect(first.status).toBe(200);
    expect(h.store.entitlementWrites).toBe(1);
    expect(h.store.events.has('evt_dup')).toBe(true);

    const second = await POST(webhookRequest(body, 'tsec_sig'));
    expect(second.status).toBe(200);
    expect(await second.json()).toEqual({ received: true, duplicate: true });
    // No second entitlement write for the same event.
    expect(h.store.entitlementWrites).toBe(1);
  });

  it('revokes Pro on customer.subscription.deleted', async () => {
    const session = {
      id: 'cs_1',
      mode: 'subscription',
      payment_status: 'paid',
      customer: 'cus_1',
      subscription: 'sub_1',
      metadata: { uid: 'user-1', planId: 'pro', billing: 'annual' },
    };
    await POST(webhookRequest(eventPayload('checkout.session.completed', session), 'tsec_sig'));
    expect((await h.store.getEntitlement('user-1'))?.plan).toBe('pro');

    const sub = { id: 'sub_1', status: 'canceled', metadata: { uid: 'user-1' } };
    const res = await POST(
      webhookRequest(eventPayload('customer.subscription.deleted', sub), 'tsec_sig'),
    );
    expect(res.status).toBe(200);
    expect((await h.store.getEntitlement('user-1'))?.plan).toBe('basic');
  });

  it('does not let an older active event re-grant after a newer cancellation', async () => {
    const session = {
      id: 'cs_order', mode: 'subscription', payment_status: 'paid', customer: 'cus_1',
      subscription: 'sub_order', metadata: { uid: 'user-order', planId: 'pro', billing: 'annual' },
    };
    await POST(webhookRequest(eventPayload('checkout.session.completed', session, 'evt_initial', 100), 'sig'));
    const canceled = { id: 'sub_order', status: 'canceled', metadata: { uid: 'user-order' } };
    await POST(webhookRequest(eventPayload('customer.subscription.deleted', canceled, 'evt_cancel', 300), 'sig'));
    const staleActive = { ...canceled, status: 'active' };
    await POST(webhookRequest(eventPayload('customer.subscription.updated', staleActive, 'evt_stale', 200), 'sig'));
    expect((await h.store.getEntitlement('user-order'))?.plan).toBe('basic');
    expect((await h.store.getEntitlement('user-order'))?.status).toBe('canceled');
  });

  it('does not grant anything on invoice.payment_failed', async () => {
    const invoice = { id: 'in_1', subscription: 'sub_1', status: 'open' };
    const res = await POST(
      webhookRequest(eventPayload('invoice.payment_failed', invoice), 'tsec_sig'),
    );
    expect(res.status).toBe(200);
    expect(h.store.entitlementWrites).toBe(0);
  });

  it('acknowledges unrelated event types without touching entitlement', async () => {
    const res = await POST(
      webhookRequest(eventPayload('payment_intent.created', { id: 'pi_1' }), 'tsec_sig'),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ received: true });
    expect(h.store.entitlementWrites).toBe(0);
  });

  it('returns Cache-Control: no-store on every response kind', async () => {
    // Missing signature (400)
    const missing = await POST(webhookRequest(eventPayload('checkout.session.completed', {})));
    expect(missing.status).toBe(400);
    expect(missing.headers.get('Cache-Control')).toBe('no-store');

    // Invalid signature (400)
    h.constructEvent.mockImplementation(() => {
      throw new Error('No signatures found matching the expected signature');
    });
    const badSig = await POST(
      webhookRequest(eventPayload('checkout.session.completed', {}), 'bad_sig'),
    );
    expect(badSig.status).toBe(400);
    expect(badSig.headers.get('Cache-Control')).toBe('no-store');

    // Successful apply + duplicate acknowledgement (200)
    h.constructEvent.mockImplementation((rawBody: string, _sig: string, secret: string) => {
      if (secret !== SECRET) throw new Error('wrong secret');
      return JSON.parse(rawBody);
    });
    const session = {
      id: 'cs_1',
      mode: 'subscription',
      payment_status: 'paid',
      customer: 'cus_1',
      subscription: 'sub_1',
      metadata: { uid: 'user-1', planId: 'pro', billing: 'annual' },
    };
    const ok = await POST(webhookRequest(eventPayload('checkout.session.completed', session), 'tsec_sig'));
    expect(ok.status).toBe(200);
    expect(ok.headers.get('Cache-Control')).toBe('no-store');

    const dup = await POST(
      webhookRequest(eventPayload('checkout.session.completed', session, 'evt_hdr'), 'tsec_sig'),
    );
    expect(dup.status).toBe(200);
    expect(dup.headers.get('Cache-Control')).toBe('no-store');

    // Webhook secret not configured (503)
    delete process.env.STRIPE_WEBHOOK_SECRET;
    const unconfigured = await POST(
      webhookRequest(eventPayload('checkout.session.completed', {}), 'sig'),
    );
    expect(unconfigured.status).toBe(503);
    expect(unconfigured.headers.get('Cache-Control')).toBe('no-store');
  });
});
