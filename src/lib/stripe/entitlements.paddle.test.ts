import { describe, expect, it } from 'vitest';
import type { EntitlementRecord, EntitlementStore } from '@/lib/stripe/entitlements';
import {
  computePaddleSubscriptionEntitlement,
  computePaddleTransactionEntitlement,
  handlePaddleSubscriptionEvent,
  handlePaddleTransactionCompleted,
  type PaddlePriceResolver,
  type PaddleSubscriptionLike,
  type PaddleTransactionLike,
} from '@/lib/stripe/entitlements';

/** Test catalog — mirrors the env-driven resolver used in production. */
const prices: PaddlePriceResolver = {
  resolvePlan: (id) => {
    if (id === 'pri_pro_monthly' || id === 'pri_pro_annual') return 'pro';
    if (id === 'pri_lifetime') return 'lifetime';
    return null;
  },
  resolveBilling: (id) => {
    if (id === 'pri_pro_monthly') return 'monthly';
    if (id === 'pri_pro_annual') return 'annual';
    return null;
  },
};

/** In-memory EntitlementStore — mirrors the Firestore semantics used in prod. */
class FakeStore implements EntitlementStore {
  records = new Map<string, EntitlementRecord>();
  events = new Set<string>();

  async getEntitlement(uid: string): Promise<EntitlementRecord | null> {
    return this.records.get(uid) ?? null;
  }

  async putEntitlement(uid: string, patch: Partial<EntitlementRecord>): Promise<void> {
    const cur = this.records.get(uid) ?? {
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
    this.records.set(uid, { ...cur, ...patch, uid });
  }

  async findUidBySubscription(stripeSubscriptionId: string): Promise<string | null> {
    for (const [uid, r] of this.records) {
      if (r.stripeSubscriptionId === stripeSubscriptionId) return uid;
    }
    return null;
  }

  async findUidByPaddleSubscription(paddleSubscriptionId: string): Promise<string | null> {
    for (const [uid, r] of this.records) {
      if (r.paddleSubscriptionId === paddleSubscriptionId) return uid;
    }
    return null;
  }

  async isEventProcessed(eventId: string): Promise<boolean> {
    return this.events.has(eventId);
  }

  async markEventProcessed(eventId: string): Promise<void> {
    this.events.add(eventId);
  }
}

function txn(overrides: Partial<PaddleTransactionLike> = {}): PaddleTransactionLike {
  return {
    id: 'txn_123',
    status: 'completed',
    customData: { uid: 'user-1', planId: 'pro', billing: 'annual' },
    items: [{ price: { id: 'pri_pro_annual' } }],
    subscriptionId: 'sub_123',
    ...overrides,
  };
}

function lifetimeTxn(overrides: Partial<PaddleTransactionLike> = {}): PaddleTransactionLike {
  return {
    id: 'txn_life',
    status: 'completed',
    customData: { uid: 'user-2', planId: 'lifetime', billing: 'annual' },
    items: [{ price: { id: 'pri_lifetime' } }],
    subscriptionId: null,
    ...overrides,
  };
}

function sub(overrides: Partial<PaddleSubscriptionLike> = {}): PaddleSubscriptionLike {
  return {
    id: 'sub_123',
    status: 'active',
    customData: { uid: 'user-1' },
    items: [{ price: { id: 'pri_pro_annual' } }],
    currentBillingPeriod: { endsAt: '2030-01-01T00:00:00Z' },
    ...overrides,
  };
}

describe('computePaddleTransactionEntitlement', () => {
  it('grants Lifetime for a completed lifetime purchase (no subscription)', () => {
    const rec = computePaddleTransactionEntitlement(lifetimeTxn(), prices);
    expect(rec).toMatchObject({
      uid: 'user-2',
      plan: 'lifetime',
      billing: 'lifetime',
      paddleSubscriptionId: null,
      paddlePriceId: 'pri_lifetime',
      status: 'active',
      currentPeriodEnd: null,
    });
  });

  it('grants Pro with the subscription id + monthly billing from the price', () => {
    const rec = computePaddleTransactionEntitlement(
      txn({ items: [{ price: { id: 'pri_pro_monthly' } }], customData: { uid: 'user-1', planId: 'pro', billing: 'monthly' } }),
      prices,
    );
    expect(rec).toMatchObject({
      uid: 'user-1',
      plan: 'pro',
      billing: 'monthly',
      paddleSubscriptionId: 'sub_123',
      paddlePriceId: 'pri_pro_monthly',
    });
  });

  it('ignores transactions that have not completed', () => {
    expect(computePaddleTransactionEntitlement(txn({ status: 'paid' }), prices)).toBeNull();
    expect(computePaddleTransactionEntitlement(txn({ status: 'canceled' }), prices)).toBeNull();
  });

  it('ignores transactions without a Firebase uid in custom data', () => {
    expect(computePaddleTransactionEntitlement(txn({ customData: null }), prices)).toBeNull();
    expect(computePaddleTransactionEntitlement(txn({ customData: { planId: 'pro' } }), prices)).toBeNull();
  });

  it('ignores transactions whose price is not in the configured catalog', () => {
    expect(computePaddleTransactionEntitlement(txn({ items: [{ price: { id: 'pri_unknown' } }] }), prices)).toBeNull();
  });
});

describe('computePaddleSubscriptionEntitlement', () => {
  it('keeps Pro with refreshed period + price while active or trialing', () => {
    const rec = computePaddleSubscriptionEntitlement(sub(), prices);
    expect(rec).toMatchObject({
      plan: 'pro',
      billing: 'annual',
      paddleSubscriptionId: 'sub_123',
      paddlePriceId: 'pri_pro_annual',
      status: 'active',
    });
    expect(rec?.currentPeriodEnd).toBe(Math.floor(Date.parse('2030-01-01T00:00:00Z') / 1000));

    expect(computePaddleSubscriptionEntitlement(sub({ status: 'trialing' }), prices)?.plan).toBe('pro');
  });

  it('revokes Pro for canceled, paused and past_due (payment failure)', () => {
    for (const status of ['canceled', 'paused', 'past_due']) {
      const rec = computePaddleSubscriptionEntitlement(sub({ status }), prices);
      expect(rec?.plan).toBe('basic');
      expect(rec?.status).toBe(status);
      // Historical id is preserved.
      expect(rec?.paddleSubscriptionId).toBe('sub_123');
    }
  });
});

describe('handlePaddleTransactionCompleted', () => {
  it('persists a Pro grant', async () => {
    const store = new FakeStore();
    await handlePaddleTransactionCompleted(store, txn(), prices);
    expect(await store.getEntitlement('user-1')).toMatchObject({
      plan: 'pro',
      billing: 'annual',
      paddleSubscriptionId: 'sub_123',
      status: 'active',
    });
  });

  it('persists a Lifetime grant', async () => {
    const store = new FakeStore();
    await handlePaddleTransactionCompleted(store, lifetimeTxn(), prices);
    expect(await store.getEntitlement('user-2')).toMatchObject({
      plan: 'lifetime',
      billing: 'lifetime',
      status: 'active',
    });
  });

  it('never downgrades an existing Lifetime owner with a later Pro purchase', async () => {
    const store = new FakeStore();
    await handlePaddleTransactionCompleted(store, lifetimeTxn(), prices);
    await handlePaddleTransactionCompleted(store, txn({ id: 'txn_later', customData: { uid: 'user-2', planId: 'pro', billing: 'annual' } }), prices);
    const rec = await store.getEntitlement('user-2');
    expect(rec?.plan).toBe('lifetime');
    expect(rec?.billing).toBe('lifetime');
  });
});

describe('handlePaddleSubscriptionEvent', () => {
  it('grants/keeps Pro via the uid in custom data', async () => {
    const store = new FakeStore();
    await handlePaddleTransactionCompleted(store, txn(), prices);
    await handlePaddleSubscriptionEvent(store, sub({ currentBillingPeriod: { endsAt: '2030-06-01T00:00:00Z' } }), prices);
    const rec = await store.getEntitlement('user-1');
    expect(rec).toMatchObject({ plan: 'pro', status: 'active' });
    expect(rec?.currentPeriodEnd).toBe(Math.floor(Date.parse('2030-06-01T00:00:00Z') / 1000));
  });

  it('maps the subscription to the user via stored id when custom data is missing', async () => {
    const store = new FakeStore();
    await handlePaddleTransactionCompleted(store, txn(), prices);
    const noCustomData: PaddleSubscriptionLike = { ...sub() };
    delete noCustomData.customData;
    await handlePaddleSubscriptionEvent(store, noCustomData, prices);
    expect((await store.getEntitlement('user-1'))?.status).toBe('active');
  });

  it('revokes Pro when the subscription is canceled', async () => {
    const store = new FakeStore();
    await handlePaddleTransactionCompleted(store, txn(), prices);
    await handlePaddleSubscriptionEvent(store, sub({ status: 'canceled' }), prices);
    const rec = await store.getEntitlement('user-1');
    expect(rec?.plan).toBe('basic');
    expect(rec?.status).toBe('canceled');
    expect(rec?.paddleSubscriptionId).toBe('sub_123');
  });

  it('revokes Pro on payment failure (past_due) without ever granting', async () => {
    const store = new FakeStore();
    // Free user with no record — a payment-failure event must not create one.
    await handlePaddleSubscriptionEvent(store, sub({ id: 'sub_new', status: 'past_due', customData: { uid: 'user-9' } }), prices);
    expect(await store.getEntitlement('user-9')).toBeNull();

    // Existing Pro user whose payment fails → revoked.
    await handlePaddleTransactionCompleted(store, txn(), prices);
    await handlePaddleSubscriptionEvent(store, sub({ status: 'past_due' }), prices);
    expect((await store.getEntitlement('user-1'))?.plan).toBe('basic');
  });

  it('Lifetime cannot be downgraded by a later subscription cancel', async () => {
    const store = new FakeStore();
    await handlePaddleTransactionCompleted(store, lifetimeTxn(), prices);
    // The (stale) pro subscription for the same user gets canceled.
    await handlePaddleSubscriptionEvent(store, sub({ customData: { uid: 'user-2' }, status: 'canceled' }), prices);
    const rec = await store.getEntitlement('user-2');
    expect(rec?.plan).toBe('lifetime');
    expect(rec?.status).toBe('active');
  });

  it('keeps Lifetime as the strongest entitlement even when a Pro sub is active', async () => {
    const store = new FakeStore();
    await handlePaddleTransactionCompleted(store, lifetimeTxn(), prices);
    await handlePaddleSubscriptionEvent(store, sub({ customData: { uid: 'user-2' }, status: 'active' }), prices);
    expect((await store.getEntitlement('user-2'))?.plan).toBe('lifetime');
  });
});
