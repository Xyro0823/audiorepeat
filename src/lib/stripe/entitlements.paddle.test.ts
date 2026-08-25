import { describe, expect, it } from 'vitest';
import type { EntitlementRecord, EntitlementStore } from '@/lib/stripe/entitlements';
import {
  computeEffectiveEntitlement,
  computePaddleSubscriptionEntitlement,
  computePaddleTransactionEntitlement,
  handlePaddleAdjustmentEvent,
  handlePaddleSubscriptionEvent,
  handlePaddleTransactionCompleted,
  type PaddleAdjustmentLike,
  type PaddlePriceResolver,
  type PaddleSubscriptionLike,
  type PaddleTransactionLike,
} from '@/lib/stripe/entitlements';

/** Test catalog ??? mirrors the env-driven resolver used in production. */
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

/** In-memory EntitlementStore ??? mirrors the Firestore semantics used in prod. */
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

  async findUidByPaddleTransaction(paddleTransactionId: string): Promise<string | null> {
    for (const [uid, r] of this.records) {
      if (r.paddleTransactionId === paddleTransactionId) return uid;
    }
    return null;
  }

  async isEventProcessed(eventId: string): Promise<boolean> {
    return this.events.has(eventId);
  }

  async markEventProcessed(eventId: string): Promise<void> {
    this.events.add(eventId);
  }

  async putPaddleEntitlementIfNewer(
    uid: string,
    patch: Partial<EntitlementRecord>,
    occurredAtMs: number,
  ): Promise<boolean> {
    const current = this.records.get(uid);
    if (typeof current?.paddleEventAt === 'number' && current.paddleEventAt >= occurredAtMs) return false;
    await this.putEntitlement(uid, { ...patch, paddleEventAt: occurredAtMs });
    return true;
  }

  async putProviderEntitlementIfNewer(
    uid: string,
    patch: Partial<EntitlementRecord>,
    provider: 'stripe' | 'paddle',
    occurredAtMs: number,
  ): Promise<boolean> {
    const field = provider === 'stripe' ? 'stripeEventAt' : 'paddleEventAt';
    const current = this.records.get(uid);
    const previous = current?.[field];
    if (typeof previous === 'number' && previous >= occurredAtMs) return false;
    await this.putEntitlement(uid, { ...patch, [field]: occurredAtMs });
    return true;
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
  it('fails closed when Paddle omits subscription status', () => {
    const rec = computePaddleSubscriptionEntitlement(sub({ status: undefined }), prices);
    expect(rec.plan).toBe('basic');
    expect(rec.status).toBe('incomplete');
  });
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

  it('revokes Pro for canceled and paused', () => {
    for (const status of ['canceled', 'paused']) {
      const rec = computePaddleSubscriptionEntitlement(sub({ status }), prices);
      expect(rec?.plan).toBe('basic');
      expect(rec?.status).toBe(status);
      // Historical id is preserved.
      expect(rec?.paddleSubscriptionId).toBe('sub_123');
    }
  });

  it('keeps Pro in dunning (past_due) ??? grace is enforced at read time', () => {
    const rec = computePaddleSubscriptionEntitlement(sub({ status: 'past_due' }), prices);
    expect(rec?.plan).toBe('pro');
    expect(rec?.status).toBe('past_due');
    expect(rec?.currentPeriodEnd).toBe(Math.floor(Date.parse('2030-01-01T00:00:00Z') / 1000));
  });
});

describe('past_due grace period (read-time)', () => {
  const graceRec = (periodEndSec: number | null): EntitlementRecord => ({
    uid: 'user-1',
    plan: 'pro',
    billing: 'annual',
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    stripePriceId: null,
    paddleSubscriptionId: 'sub_123',
    paddlePriceId: 'pri_pro_annual',
    status: 'past_due',
    currentPeriodEnd: periodEndSec,
    updatedAt: 0,
  });
  const future = Math.floor(Date.parse('2030-01-01T00:00:00Z') / 1000);

  it('keeps Pro while the paid period has not ended', () => {
    expect(computeEffectiveEntitlement(graceRec(future), future - 1).plan).toBe('pro');
  });

  it('revokes once the paid period ends', () => {
    expect(computeEffectiveEntitlement(graceRec(future), future + 1).plan).toBe('basic');
  });

  it('fails closed when no period end is known', () => {
    expect(computeEffectiveEntitlement(graceRec(null), Date.now() / 1000).plan).toBe('basic');
  });

  it('active/trialing are unaffected by the grace logic', () => {
    for (const status of ['active', 'trialing']) {
      expect(
        computeEffectiveEntitlement({ ...graceRec(null), status }, Date.now() / 1000).plan,
      ).toBe('pro');
    }
  });
});

describe('Paddle subscription event ordering', () => {
  it('does not let an older active event re-grant after a newer cancellation', async () => {
    const store = new FakeStore();
    await store.putEntitlement('user-1', { uid: 'user-1', plan: 'pro', status: 'active' });
    await handlePaddleSubscriptionEvent(store, sub({ status: 'canceled' }), prices, 2000);
    await handlePaddleSubscriptionEvent(store, sub({ status: 'active' }), prices, 1000);
    expect((await store.getEntitlement('user-1'))?.plan).toBe('basic');
    expect((await store.getEntitlement('user-1'))?.status).toBe('canceled');
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

  it('records dunning without revoking an existing Pro grant', async () => {
    const store = new FakeStore();
    // Free user with no record ??? a payment-failure event must not create one.
    await handlePaddleSubscriptionEvent(store, sub({ id: 'sub_new', status: 'past_due', customData: { uid: 'user-9' } }), prices);
    expect(await store.getEntitlement('user-9')).toBeNull();

    // Existing Pro user whose payment fails ??? kept on grace (read-time check
    // decides once the paid period ends).
    await handlePaddleTransactionCompleted(store, txn(), prices);
    await handlePaddleSubscriptionEvent(store, sub({ status: 'past_due' }), prices);
    const rec = await store.getEntitlement('user-1');
    expect(rec?.plan).toBe('pro');
    expect(rec?.status).toBe('past_due');
  });

  it('a past_due event can never resurrect a revoked subscription', async () => {
    const store = new FakeStore();
    await handlePaddleTransactionCompleted(store, txn(), prices);
    await handlePaddleSubscriptionEvent(store, sub({ status: 'canceled' }), prices);
    await handlePaddleSubscriptionEvent(store, sub({ status: 'past_due', currentBillingPeriod: { endsAt: '2030-01-01T00:00:00Z' } }), prices);
    const rec = await store.getEntitlement('user-1');
    expect(rec?.plan).toBe('basic');
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

describe('handlePaddleAdjustmentEvent (refunds / chargebacks)', () => {
  function adjustment(overrides: Partial<PaddleAdjustmentLike> = {}): PaddleAdjustmentLike {
    return { id: 'adj_1', action: 'refund', transactionId: 'txn_life', ...overrides };
  }

  it('revokes Lifetime when its purchase is refunded', async () => {
    const store = new FakeStore();
    await handlePaddleTransactionCompleted(store, lifetimeTxn(), prices);
    await handlePaddleAdjustmentEvent(store, adjustment(), 3000);
    const rec = await store.getEntitlement('user-2');
    expect(rec?.plan).toBe('basic');
    expect(rec?.billing).toBeNull();
    expect(rec?.status).toBe('refunded');
  });

  it('marks a charged-back Lifetime purchase', async () => {
    const store = new FakeStore();
    await handlePaddleTransactionCompleted(store, lifetimeTxn(), prices);
    await handlePaddleAdjustmentEvent(store, adjustment({ action: 'chargeback' }), 3000);
    expect((await store.getEntitlement('user-2'))?.status).toBe('charged_back');
    expect((await store.getEntitlement('user-2'))?.plan).toBe('basic');
  });

  it('revokes Pro on a chargeback against the subscription transaction', async () => {
    const store = new FakeStore();
    await handlePaddleTransactionCompleted(store, txn(), prices);
    await handlePaddleAdjustmentEvent(
      store,
      adjustment({ action: 'chargeback', transactionId: 'txn_123' }),
      3000,
    );
    const rec = await store.getEntitlement('user-1');
    expect(rec?.plan).toBe('basic');
    expect(rec?.status).toBe('charged_back');
    // Historical subscription id survives for support lookups.
    expect(rec?.paddleSubscriptionId).toBe('sub_123');
  });

  it('ignores plain subscription refunds ??? the lifecycle stays authoritative', async () => {
    const store = new FakeStore();
    await handlePaddleTransactionCompleted(store, txn(), prices);
    await handlePaddleSubscriptionEvent(store, sub(), prices);
    await handlePaddleAdjustmentEvent(
      store,
      adjustment({ action: 'refund', transactionId: 'txn_123' }),
      3000,
    );
    expect((await store.getEntitlement('user-1'))?.plan).toBe('pro');
  });

  it('ignores adjustments for unknown or mismatched transactions', async () => {
    const store = new FakeStore();
    await handlePaddleTransactionCompleted(store, lifetimeTxn(), prices, 1000);

    // Unknown transaction id ??? no uid mapping ??? no-op.
    await handlePaddleAdjustmentEvent(store, adjustment({ transactionId: 'txn_unknown' }), 3000);
    expect((await store.getEntitlement('user-2'))?.plan).toBe('lifetime');

    // Missing transaction id entirely.
    await handlePaddleAdjustmentEvent(store, adjustment({ transactionId: null }), 3001);
    expect((await store.getEntitlement('user-2'))?.plan).toBe('lifetime');

    // Refund the original purchase, then buy again. The OLD transaction's
    // adjustment (even replayed newer) must not touch the new grant.
    await handlePaddleAdjustmentEvent(store, adjustment(), 2000);
    await handlePaddleTransactionCompleted(
      store,
      lifetimeTxn({ id: 'txn_life2', customData: { uid: 'user-2', planId: 'lifetime' } }),
      prices,
      4000,
    );
    await handlePaddleAdjustmentEvent(store, adjustment({ transactionId: 'txn_life' }), 5000);
    const rec = await store.getEntitlement('user-2');
    expect(rec?.paddleTransactionId).toBe('txn_life2');
    expect(rec?.plan).toBe('lifetime');
    expect(rec?.status).toBe('active');
  });

  it('never revokes an active manual gift via an adjustment', async () => {
    const store = new FakeStore();
    await handlePaddleTransactionCompleted(store, lifetimeTxn(), prices);
    await store.putEntitlement('user-2', {
      manual: {
        plan: 'lifetime',
        reason: 'gift',
        expiresAt: null,
        grantedAt: 1,
        grantedBy: 'admin',
        revokedAt: null,
        revokedBy: null,
      },
    });
    await handlePaddleAdjustmentEvent(store, adjustment(), 3000);
    const rec = await store.getEntitlement('user-2');
    expect(rec?.manual?.revokedAt).toBeNull();
    // Effective plan still driven by the untouched gift.
    expect(computeEffectiveEntitlement(rec, Date.now() / 1000).plan).toBe('lifetime');
  });

  it('duplicate and out-of-order adjustments are inert', async () => {
    const store = new FakeStore();
    // Purchase at t=1000, refunded at t=3000.
    await handlePaddleTransactionCompleted(store, lifetimeTxn(), prices, 1000);
    await handlePaddleAdjustmentEvent(store, adjustment(), 3000);
    const rec = await store.getEntitlement('user-2');
    expect(rec?.status).toBe('refunded');

    // Same adjustment replayed with the same/older timestamp ??? no change.
    await handlePaddleAdjustmentEvent(store, adjustment({ action: 'chargeback' }), 3000);
    await handlePaddleAdjustmentEvent(store, adjustment(), 2999);
    expect((await store.getEntitlement('user-2'))?.status).toBe('refunded');

    // A stale `transaction.completed` replay (t=1000) cannot re-grant over
    // the newer refund ??? the ordering guard covers Lifetime purchases too.
    await handlePaddleTransactionCompleted(store, lifetimeTxn(), prices, 1000);
    expect((await store.getEntitlement('user-2'))?.status).toBe('refunded');
  });

  it('a genuinely NEW purchase after a refund re-grants normally', async () => {
    const store = new FakeStore();
    await handlePaddleTransactionCompleted(store, lifetimeTxn({ id: 'txn_life_a' }), prices, 1000);
    await handlePaddleAdjustmentEvent(store, adjustment({ transactionId: 'txn_life_a' }), 3000);
    expect((await store.getEntitlement('user-2'))?.plan).toBe('basic');

    await handlePaddleTransactionCompleted(
      store,
      lifetimeTxn({ id: 'txn_life_b', customData: { uid: 'user-2', planId: 'lifetime' } }),
      prices,
      5000,
    );
    expect((await store.getEntitlement('user-2'))?.plan).toBe('lifetime');
    expect((await store.getEntitlement('user-2'))?.paddleTransactionId).toBe('txn_life_b');
  });

  it('route-level idempotency: a replayed eventId never re-applies', async () => {
    const store = new FakeStore();
    await handlePaddleTransactionCompleted(store, lifetimeTxn(), prices, 1000);
    // Mirrors webhook route.ts flow for one delivery + its Paddle retry.
    if (!(await store.isEventProcessed('evt_1'))) {
      await handlePaddleAdjustmentEvent(store, adjustment(), 3000);
      await store.markEventProcessed('evt_1');
    }
    // Retry delivery: marker short-circuits before any handler runs.
    if (!(await store.isEventProcessed('evt_1'))) {
      await handlePaddleAdjustmentEvent(store, adjustment({ action: 'chargeback' }), 3001);
      await store.markEventProcessed('evt_1');
    }
    expect((await store.getEntitlement('user-2'))?.status).toBe('refunded');
  });
});
