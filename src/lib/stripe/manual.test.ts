import { describe, expect, it } from 'vitest';
import type { EntitlementRecord, EntitlementStore, ManualEntitlement } from '@/lib/stripe/entitlements';
import {
  computeEffectiveEntitlement,
  handlePaddleSubscriptionEvent,
  handlePaddleTransactionCompleted,
  isManualActive,
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

const NOW = 1_800_000_000; // fixed "now" for deterministic expiry tests

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

function rec(overrides: Partial<EntitlementRecord> = {}): EntitlementRecord {
  return {
    uid: 'user-1',
    plan: 'basic',
    billing: null,
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    stripePriceId: null,
    paddleSubscriptionId: null,
    paddlePriceId: null,
    status: 'active',
    currentPeriodEnd: null,
    updatedAt: 0,
    ...overrides,
  };
}

function manual(overrides: Partial<ManualEntitlement> = {}): ManualEntitlement {
  return {
    plan: 'pro',
    reason: 'Creator gift',
    expiresAt: null,
    grantedAt: NOW - 1000,
    grantedBy: 'admin-1',
    revokedAt: null,
    revokedBy: null,
    ...overrides,
  };
}

/** A record that reflects a live Paddle Pro subscription (provider state). */
function providerPro(overrides: Partial<EntitlementRecord> = {}): EntitlementRecord {
  return rec({
    plan: 'pro',
    billing: 'annual',
    paddleSubscriptionId: 'sub_1',
    paddlePriceId: 'pri_pro_annual',
    status: 'active',
    currentPeriodEnd: NOW + 2_592_000,
    ...overrides,
  });
}

function txn(overrides: Partial<PaddleTransactionLike> = {}): PaddleTransactionLike {
  return {
    id: 'txn_123',
    status: 'completed',
    customData: { uid: 'user-1', planId: 'pro', billing: 'annual' },
    items: [{ price: { id: 'pri_pro_annual' } }],
    subscriptionId: 'sub_1',
    ...overrides,
  };
}

function sub(overrides: Partial<PaddleSubscriptionLike> = {}): PaddleSubscriptionLike {
  return {
    id: 'sub_1',
    status: 'canceled',
    customData: { uid: 'user-1' },
    items: [{ price: { id: 'pri_pro_annual' } }],
    currentBillingPeriod: { endsAt: new Date(NOW * 1000).toISOString() },
    ...overrides,
  };
}

describe('isManualActive', () => {
  it('is active with no expiry and no revoke', () => {
    expect(isManualActive(manual(), NOW)).toBe(true);
  });

  it('is inactive once revoked', () => {
    expect(
      isManualActive(manual({ revokedAt: NOW - 10, revokedBy: 'admin-1' }), NOW),
    ).toBe(false);
  });

  it('is inactive after expiry', () => {
    expect(isManualActive(manual({ expiresAt: NOW - 1 }), NOW)).toBe(false);
  });

  it('is active before expiry', () => {
    expect(isManualActive(manual({ expiresAt: NOW + 86_400 }), NOW)).toBe(true);
  });

  it('treats the expiry instant itself as expired', () => {
    expect(isManualActive(manual({ expiresAt: NOW }), NOW)).toBe(false);
  });
});

describe('computeEffectiveEntitlement — strongest valid entitlement wins', () => {
  it('A: manual Pro with no Paddle subscription → Pro', () => {
    const effective = computeEffectiveEntitlement(
      rec({ manual: manual() }),
      NOW,
    );
    expect(effective).toEqual({ plan: 'pro', billing: null, status: 'active', currentPeriodEnd: null });
  });

  it('B: manual Pro + Paddle cancellation → still Pro (gift survives revoke)', () => {
    const effective = computeEffectiveEntitlement(
      rec({ plan: 'basic', status: 'canceled', paddleSubscriptionId: 'sub_1', manual: manual() }),
      NOW,
    );
    expect(effective.plan).toBe('pro');
  });

  it('C: manual Pro expired + no Paddle subscription → Free', () => {
    const effective = computeEffectiveEntitlement(
      rec({ manual: manual({ expiresAt: NOW - 1 }) }),
      NOW,
    );
    expect(effective.plan).toBe('basic');
  });

  it('D: manual Pro expired + active Paddle subscription → Pro from provider', () => {
    const effective = computeEffectiveEntitlement(
      providerPro({ manual: manual({ expiresAt: NOW - 1 }) }),
      NOW,
    );
    expect(effective).toEqual({
      plan: 'pro',
      billing: 'annual',
      status: 'active',
      currentPeriodEnd: NOW + 2_592_000,
    });
  });

  it('E: Lifetime + Paddle cancellation → stays Lifetime', () => {
    const effective = computeEffectiveEntitlement(
      rec({ plan: 'lifetime', billing: 'lifetime', status: 'canceled' }),
      NOW,
    );
    expect(effective.plan).toBe('lifetime');
  });

  it('F: active Paddle Pro with no manual grant → normal Pro behavior', () => {
    const effective = computeEffectiveEntitlement(providerPro(), NOW);
    expect(effective.plan).toBe('pro');
    expect(effective.billing).toBe('annual');
  });

  it('G: manual revoked + active Paddle subscription → Pro from provider', () => {
    const effective = computeEffectiveEntitlement(
      providerPro({ manual: manual({ revokedAt: NOW - 10, revokedBy: 'admin-1' }) }),
      NOW,
    );
    expect(effective.plan).toBe('pro');
    expect(effective.billing).toBe('annual');
  });

  it('H: manual revoked + no other entitlement → Free', () => {
    const effective = computeEffectiveEntitlement(
      rec({ manual: manual({ revokedAt: NOW - 10, revokedBy: 'admin-1' }) }),
      NOW,
    );
    expect(effective.plan).toBe('basic');
  });

  it('manual Lifetime wins over an active provider subscription', () => {
    const effective = computeEffectiveEntitlement(
      providerPro({ manual: manual({ plan: 'lifetime' }) }),
      NOW,
    );
    expect(effective).toEqual({ plan: 'lifetime', billing: 'lifetime', status: 'active', currentPeriodEnd: null });
  });

  it('expired manual Lifetime falls back to the provider subscription if any', () => {
    const effective = computeEffectiveEntitlement(
      providerPro({ manual: manual({ plan: 'lifetime', expiresAt: NOW - 1 }) }),
      NOW,
    );
    expect(effective.plan).toBe('pro');
  });

  it('expired manual Lifetime with no provider → Free', () => {
    const effective = computeEffectiveEntitlement(
      rec({ manual: manual({ plan: 'lifetime', expiresAt: NOW - 1 }) }),
      NOW,
    );
    expect(effective.plan).toBe('basic');
  });

  it('provider Lifetime survives even after a manual Lifetime grant is revoked', () => {
    const effective = computeEffectiveEntitlement(
      rec({
        plan: 'lifetime',
        billing: 'lifetime',
        manual: manual({ plan: 'lifetime', revokedAt: NOW - 10, revokedBy: 'admin-1' }),
      }),
      NOW,
    );
    expect(effective.plan).toBe('lifetime');
  });

  it('missing record → Free', () => {
    expect(computeEffectiveEntitlement(null, NOW)).toEqual({
      plan: 'basic',
      billing: null,
      status: null,
      currentPeriodEnd: null,
    });
  });

  it('a paused/past_due provider subscription without a manual grant is Free', () => {
    expect(computeEffectiveEntitlement(rec({ status: 'past_due', paddleSubscriptionId: 'sub_1' }), NOW).plan).toBe('basic');
    expect(computeEffectiveEntitlement(rec({ status: 'canceled', paddleSubscriptionId: 'sub_1' }), NOW).plan).toBe('basic');
  });

  it('trialing provider subscription keeps Pro', () => {
    expect(computeEffectiveEntitlement(providerPro({ status: 'trialing' }), NOW).plan).toBe('pro');
  });
});

describe('Paddle handlers preserve manual grants', () => {
  it('a subscription cancellation records provider state but keeps the manual Pro', async () => {
    const store = new FakeStore();
    store.records.set('user-1', providerPro({ manual: manual() }));

    await handlePaddleSubscriptionEvent(store, sub({ status: 'canceled' }), prices);

    const record = await store.getEntitlement('user-1');
    // Provider state is refreshed (status/period end), the manual grant survives.
    expect(record?.status).toBe('canceled');
    expect(record?.manual).toMatchObject({ plan: 'pro', revokedAt: null });
    expect(computeEffectiveEntitlement(record, NOW).plan).toBe('pro');
  });

  it('a payment-failure (past_due) event never revokes an active manual Pro', async () => {
    const store = new FakeStore();
    store.records.set('user-1', providerPro({ manual: manual() }));

    await handlePaddleSubscriptionEvent(store, sub({ status: 'past_due' }), prices);

    const record = await store.getEntitlement('user-1');
    expect(record?.status).toBe('past_due');
    expect(computeEffectiveEntitlement(record, NOW).plan).toBe('pro');
  });

  it('a transaction purchase preserves an existing manual grant', async () => {
    const store = new FakeStore();
    store.records.set('user-1', rec({ manual: manual({ plan: 'lifetime' }) }));

    // A later Pro purchase must not erase the manual Lifetime.
    await handlePaddleTransactionCompleted(store, txn(), prices);

    const record = await store.getEntitlement('user-1');
    expect(record?.manual?.plan).toBe('lifetime');
    expect(computeEffectiveEntitlement(record, NOW).plan).toBe('lifetime');
  });

  it('a subscription cancellation for a manual Lifetime owner changes nothing', async () => {
    const store = new FakeStore();
    store.records.set('user-1', rec({ manual: manual({ plan: 'lifetime' }) }));

    await handlePaddleSubscriptionEvent(store, sub({ status: 'canceled' }), prices);

    const record = await store.getEntitlement('user-1');
    expect(record?.manual?.plan).toBe('lifetime');
    expect(computeEffectiveEntitlement(record, NOW).plan).toBe('lifetime');
  });

  it('a past_due event for an unknown user still never creates a record', async () => {
    const store = new FakeStore();
    await handlePaddleSubscriptionEvent(
      store,
      sub({ id: 'sub_new', customData: { uid: 'user-9' }, status: 'past_due' }),
      prices,
    );
    expect(await store.getEntitlement('user-9')).toBeNull();
  });
});
