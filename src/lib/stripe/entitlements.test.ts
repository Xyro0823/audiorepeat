import { describe, expect, it } from 'vitest';
import type { EntitlementRecord, EntitlementStore } from '@/lib/stripe/entitlements';
import {
  computeCheckoutSessionEntitlement,
  computeInvoicePaymentFailed,
  computeSubscriptionDeleted,
  computeSubscriptionEntitlement,
  handleCheckoutSessionCompleted,
  handleInvoicePaymentFailed,
  handleSubscriptionDeleted,
  handleSubscriptionUpdated,
  toPublicEntitlement,
} from '@/lib/stripe/entitlements';
import type {
  CheckoutSessionLike,
  InvoiceLike,
  SubscriptionLike,
} from '@/lib/stripe/entitlements';

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

  async isEventProcessed(eventId: string): Promise<boolean> {
    return this.events.has(eventId);
  }

  async markEventProcessed(eventId: string): Promise<void> {
    this.events.add(eventId);
  }
}

function proSession(overrides: Partial<CheckoutSessionLike> = {}): CheckoutSessionLike {
  return {
    id: 'cs_test_1',
    mode: 'subscription',
    payment_status: 'paid',
    customer: 'cus_123',
    subscription: 'sub_123',
    metadata: { uid: 'user-1', planId: 'pro', billing: 'annual' },
    ...overrides,
  };
}

function lifetimeSession(overrides: Partial<CheckoutSessionLike> = {}): CheckoutSessionLike {
  return {
    id: 'cs_test_life',
    mode: 'payment',
    payment_status: 'paid',
    customer: 'cus_456',
    subscription: null,
    metadata: { uid: 'user-2', planId: 'lifetime', billing: 'annual' },
    ...overrides,
  };
}

function activeSubscription(overrides: Partial<SubscriptionLike> = {}): SubscriptionLike {
  return {
    id: 'sub_123',
    status: 'active',
    current_period_end: 1_800_000_000,
    metadata: { uid: 'user-1' },
    items: { data: [{ price: { id: 'price_pro_annual' } }] },
    ...overrides,
  };
}

describe('computeCheckoutSessionEntitlement', () => {
  it('grants Pro with customer + subscription ids for a paid subscription session', () => {
    const rec = computeCheckoutSessionEntitlement(proSession());
    expect(rec).toMatchObject({
      uid: 'user-1',
      plan: 'pro',
      billing: 'annual',
      stripeCustomerId: 'cus_123',
      stripeSubscriptionId: 'sub_123',
      status: 'active',
    });
  });

  it('respects monthly billing', () => {
    const rec = computeCheckoutSessionEntitlement(proSession({ metadata: { uid: 'user-1', planId: 'pro', billing: 'monthly' } }));
    expect(rec?.billing).toBe('monthly');
  });

  it('keeps Lifetime active with no subscription id', () => {
    const rec = computeCheckoutSessionEntitlement(lifetimeSession());
    expect(rec).toMatchObject({
      uid: 'user-2',
      plan: 'lifetime',
      billing: 'lifetime',
      stripeSubscriptionId: null,
      status: 'active',
    });
  });

  it('ignores unpaid sessions', () => {
    expect(computeCheckoutSessionEntitlement(proSession({ payment_status: 'unpaid' }))).toBeNull();
  });

  it('ignores sessions without a Firebase uid', () => {
    expect(
      computeCheckoutSessionEntitlement(proSession({ metadata: { uid: '', planId: 'pro', billing: 'annual' } })),
    ).toBeNull();
  });

  it('ignores basic-plan and unknown-plan sessions', () => {
    expect(
      computeCheckoutSessionEntitlement(proSession({ metadata: { uid: 'user-1', planId: 'basic', billing: 'annual' } })),
    ).toBeNull();
    expect(
      computeCheckoutSessionEntitlement(proSession({ metadata: { uid: 'user-1', planId: 'enterprise', billing: 'annual' } })),
    ).toBeNull();
  });
});

describe('checkout.session.completed handler', () => {
  it('persists the Pro entitlement (grant flow)', async () => {
    const store = new FakeStore();
    await handleCheckoutSessionCompleted(store, proSession());
    const rec = await store.getEntitlement('user-1');
    expect(rec).toMatchObject({ plan: 'pro', billing: 'annual', stripeSubscriptionId: 'sub_123' });
  });

  it('keeps Lifetime active after a successful payment', async () => {
    const store = new FakeStore();
    await handleCheckoutSessionCompleted(store, lifetimeSession());
    const rec = await store.getEntitlement('user-2');
    expect(rec).toMatchObject({ plan: 'lifetime', billing: 'lifetime', stripeSubscriptionId: null, status: 'active' });

    // A later subscription event for some OTHER subscription must not touch it.
    await handleSubscriptionDeleted(store, { id: 'sub_unrelated', status: 'canceled' });
    expect((await store.getEntitlement('user-2'))?.plan).toBe('lifetime');
  });

  it('is idempotent when applied twice (same session → same record)', async () => {
    const store = new FakeStore();
    await handleCheckoutSessionCompleted(store, proSession());
    await handleCheckoutSessionCompleted(store, proSession());
    const rec = await store.getEntitlement('user-1');
    expect(rec).toMatchObject({ plan: 'pro', status: 'active', stripeSubscriptionId: 'sub_123' });
  });
});

describe('customer.subscription.updated handler', () => {
  it('keeps Pro entitled with refreshed period + price while active', async () => {
    const store = new FakeStore();
    await handleCheckoutSessionCompleted(store, proSession());
    await handleSubscriptionUpdated(store, activeSubscription({ current_period_end: 1_900_000_000 }));
    const rec = await store.getEntitlement('user-1');
    expect(rec).toMatchObject({
      plan: 'pro',
      status: 'active',
      currentPeriodEnd: 1_900_000_000,
      stripePriceId: 'price_pro_annual',
    });
  });

  it('revokes Pro when the subscription is canceled/unpaid', async () => {
    const store = new FakeStore();
    await handleCheckoutSessionCompleted(store, proSession());
    await handleSubscriptionUpdated(store, activeSubscription({ status: 'canceled' }));
    expect((await store.getEntitlement('user-1'))?.plan).toBe('basic');

    await handleCheckoutSessionCompleted(store, proSession({ id: 'cs_test_2' }));
    await handleSubscriptionUpdated(store, activeSubscription({ id: 'sub_999', status: 'unpaid' }));
    expect((await store.getEntitlement('user-1'))?.plan).toBe('basic');
  });

  it('maps the subscription to the user via stored id when metadata is missing', async () => {
    const store = new FakeStore();
    await handleCheckoutSessionCompleted(store, proSession());
    const noMetadata: SubscriptionLike = { ...activeSubscription() };
    delete noMetadata.metadata;
    await handleSubscriptionUpdated(store, noMetadata);
    expect((await store.getEntitlement('user-1'))?.status).toBe('active');
  });
});

describe('customer.subscription.deleted handler', () => {
  it('revokes Pro but preserves the historical subscription id', async () => {
    const store = new FakeStore();
    await handleCheckoutSessionCompleted(store, proSession());
    await handleSubscriptionDeleted(store, activeSubscription({ status: 'canceled' }));
    const rec = await store.getEntitlement('user-1');
    expect(rec?.plan).toBe('basic');
    expect(rec?.stripeSubscriptionId).toBe('sub_123');
    expect(rec?.status).toBe('canceled');
  });
});

describe('invoice.payment_failed handler', () => {
  it('never grants Pro to a free user', async () => {
    const store = new FakeStore();
    const invoice: InvoiceLike = { id: 'in_1', subscription: 'sub_123', status: 'open' };
    await handleInvoicePaymentFailed(store, invoice);
    expect(await store.getEntitlement('user-1')).toBeNull();
  });

  it('marks an existing subscription past_due without granting anything', async () => {
    const store = new FakeStore();
    await handleCheckoutSessionCompleted(store, proSession());
    const before = await store.getEntitlement('user-1');
    await handleInvoicePaymentFailed(store, { id: 'in_1', subscription: 'sub_123', status: 'open' });
    const after = await store.getEntitlement('user-1');
    expect(after?.status).toBe('past_due');
    expect(after?.plan).toBe(before?.plan); // plan unchanged — no promotion
  });

  it('ignores invoices without a subscription id', () => {
    expect(computeInvoicePaymentFailed({ id: 'in_2', subscription: null })).toBeNull();
  });
});

describe('computeSubscriptionEntitlement', () => {
  it('derives a revoke patch for non-entitled statuses', () => {
    const patch = computeSubscriptionEntitlement(activeSubscription({ status: 'incomplete_expired' }));
    expect(patch.plan).toBe('basic');
    expect(patch.status).toBe('incomplete_expired');
    expect(patch.stripeSubscriptionId).toBe('sub_123');
  });

  it('treats trialing as entitled', () => {
    expect(computeSubscriptionEntitlement(activeSubscription({ status: 'trialing' })).plan).toBe('pro');
  });
});

describe('computeSubscriptionDeleted', () => {
  it('always revokes and keeps the historical ids', () => {
    const patch = computeSubscriptionDeleted(activeSubscription({ status: 'canceled' }));
    expect(patch).toMatchObject({
      plan: 'basic',
      status: 'canceled',
      stripeSubscriptionId: 'sub_123',
      stripePriceId: 'price_pro_annual',
    });
  });
});

describe('toPublicEntitlement', () => {
  it('defaults a missing record to Free', () => {
    expect(toPublicEntitlement(null)).toEqual({ plan: 'basic', billing: null, status: null, currentPeriodEnd: null });
  });

  it('never exposes internal stripe ids', () => {
    const pub = toPublicEntitlement({
      uid: 'u',
      plan: 'pro',
      billing: 'annual',
      stripeCustomerId: 'cus_1',
      stripeSubscriptionId: 'sub_1',
      stripePriceId: 'price_1',
      status: 'active',
      currentPeriodEnd: 123,
      updatedAt: 0,
    });
    expect(pub).toEqual({ plan: 'pro', billing: 'annual', status: 'active', currentPeriodEnd: 123 });
    expect(JSON.stringify(pub)).not.toContain('cus_');
    expect(JSON.stringify(pub)).not.toContain('sub_1');
  });
});
