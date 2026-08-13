/**
 * Server-side Stripe entitlement model.
 *
 * This module is the single source of truth for what a user is entitled to
 * (Free / Pro / Lifetime). It is deliberately free of any Firebase or HTTP
 * imports so the pure logic is unit-testable: the computations below take
 * Stripe-shaped objects (what the webhook delivers) and produce entitlement
 * patches, while persistence happens through the `EntitlementStore` interface
 * implemented by the Firestore-backed store in `@/lib/firebase/admin`.
 *
 * Entitlement rules:
 *  - Pro is a *subscription*: active/trialing = entitled, anything else
 *    (past_due beyond grace, unpaid, canceled, incomplete_expired) = revoked.
 *  - Lifetime is a *one-time payment*: once paid it stays active forever —
 *    no subscription id, nothing ever revokes it.
 *  - Free is the default; absence of a record means Free.
 */
import { isPlanId, type PlanId } from '@/lib/plans';

export type EntitlementBilling = 'monthly' | 'annual' | 'lifetime' | null;

export interface EntitlementRecord {
  /** Firebase uid — the document id in Firestore is also the uid. */
  uid: string;
  plan: PlanId;
  billing: EntitlementBilling;
  stripeCustomerId: string | null;
  /** Present for subscriptions only (never for Lifetime). */
  stripeSubscriptionId: string | null;
  /** The current Stripe price id, when known. */
  stripePriceId: string | null;
  /** Stripe subscription status ('active', 'trialing', 'past_due', …) or 'active' for Lifetime. */
  status: string;
  /** Unix seconds when the current billing period ends (subscriptions only). */
  currentPeriodEnd: number | null;
  /** Server timestamp of the last write. */
  updatedAt: unknown;
}

/** Persistence boundary — implemented by the Firestore store in admin.ts. */
export interface EntitlementStore {
  getEntitlement(uid: string): Promise<EntitlementRecord | null>;
  putEntitlement(uid: string, patch: Partial<EntitlementRecord>): Promise<void>;
  /** Map a Stripe subscription id back to the owning uid (for events whose payload lacks metadata). */
  findUidBySubscription(stripeSubscriptionId: string): Promise<string | null>;
  /** Idempotency markers for processed Stripe events. */
  isEventProcessed(eventId: string): Promise<boolean>;
  markEventProcessed(eventId: string): Promise<void>;
}

/** Stripe subscription statuses that keep Pro entitlement active. */
const ENTITLED_SUBSCRIPTION_STATUSES = new Set(['active', 'trialing']);

/* ------------------------------------------------------------------------ */
/* Stripe event payload shapes (the minimal subset the handlers read)       */
/* ------------------------------------------------------------------------ */

export interface CheckoutSessionLike {
  id: string;
  mode?: string | null;
  payment_status?: string | null;
  customer?: string | null;
  subscription?: string | null;
  metadata?: { uid?: string; planId?: string; billing?: string };
}

export interface SubscriptionLike {
  id: string;
  status?: string | null;
  current_period_end?: number | null;
  metadata?: { uid?: string };
  items?: { data?: { price?: { id?: string } | null }[] };
}

export interface InvoiceLike {
  id: string;
  subscription?: string | null;
  status?: string | null;
}

/* ------------------------------------------------------------------------ */
/* Pure computations                                                        */
/* ------------------------------------------------------------------------ */

/**
 * Derive the entitlement patch for a `checkout.session.completed` event.
 * Returns null when the event should be ignored (not paid, missing uid,
 * unexpected mode). Never throws on malformed payloads.
 */
export function computeCheckoutSessionEntitlement(
  session: CheckoutSessionLike,
): Omit<EntitlementRecord, 'updatedAt'> | null {
  const uid = session.metadata?.uid;
  if (!uid) return null;
  if (session.payment_status !== 'paid') return null;

  const planId = session.metadata?.planId;
  if (!isPlanId(planId) || planId === 'basic') return null;

  const billing = session.metadata?.billing;
  if (session.mode === 'subscription') {
    return {
      uid,
      plan: 'pro',
      billing: billing === 'monthly' ? 'monthly' : 'annual',
      stripeCustomerId: session.customer ?? null,
      stripeSubscriptionId: session.subscription ?? null,
      stripePriceId: null, // refined by customer.subscription.updated
      status: 'active',
      currentPeriodEnd: null,
    };
  }
  if (session.mode === 'payment') {
    // Lifetime — one-time payment, stays active with no subscription.
    return {
      uid,
      plan: 'lifetime',
      billing: 'lifetime',
      stripeCustomerId: session.customer ?? null,
      stripeSubscriptionId: null,
      stripePriceId: null,
      status: 'active',
      currentPeriodEnd: null,
    };
  }
  return null; // setup / other modes are not purchases
}

/**
 * Derive the entitlement patch for a `customer.subscription.updated` event.
 * Active/trialing keeps Pro (with refreshed period + price); every other
 * Stripe lifecycle status revokes Pro back to Free. Returns null when the
 * subscription is unknown (handlers fall back to a lookup by subscription id).
 */
export function computeSubscriptionEntitlement(
  sub: SubscriptionLike,
): Omit<EntitlementRecord, 'updatedAt' | 'uid' | 'stripeCustomerId'> {
  const status = sub.status ?? 'incomplete';
  const currentPeriodEnd = typeof sub.current_period_end === 'number' ? sub.current_period_end : null;
  const stripePriceId = sub.items?.data?.[0]?.price?.id ?? null;

  if (ENTITLED_SUBSCRIPTION_STATUSES.has(status)) {
    return {
      plan: 'pro',
      billing: null, // keep whatever billing the record already has
      stripeSubscriptionId: sub.id,
      stripePriceId,
      status,
      currentPeriodEnd,
    };
  }
  // Not entitled — revoke Pro but keep the subscription id + status for history.
  return {
    plan: 'basic',
    billing: null,
    stripeSubscriptionId: sub.id,
    stripePriceId,
    status,
    currentPeriodEnd,
  };
}

/**
 * Derive the entitlement patch for `customer.subscription.deleted` — always
 * revokes Pro. Historical Stripe ids are preserved on the record.
 */
export function computeSubscriptionDeleted(
  sub: SubscriptionLike,
): Omit<EntitlementRecord, 'updatedAt' | 'uid' | 'stripeCustomerId'> {
  return {
    plan: 'basic',
    billing: null,
    stripeSubscriptionId: sub.id,
    stripePriceId: sub.items?.data?.[0]?.price?.id ?? null,
    status: 'canceled',
    currentPeriodEnd: typeof sub.current_period_end === 'number' ? sub.current_period_end : null,
  };
}

/**
 * Derive the entitlement patch for `invoice.payment_failed`. This NEVER
 * grants anything: a failed payment at worst marks the current state as
 * past_due (Stripe's grace period semantics) and the follow-up
 * subscription.updated/deleted events revoke when Stripe actually cancels.
 */
export function computeInvoicePaymentFailed(
  invoice: InvoiceLike,
): Omit<EntitlementRecord, 'updatedAt' | 'uid' | 'stripeCustomerId' | 'plan' | 'billing'> | null {
  if (!invoice.subscription) return null;
  return {
    stripeSubscriptionId: invoice.subscription,
    stripePriceId: null,
    status: 'past_due',
    currentPeriodEnd: null,
  };
}

/** Public shape for client consumption (never exposes internal ids). */
export interface PublicEntitlement {
  plan: PlanId;
  billing: EntitlementBilling;
  status: string | null;
  currentPeriodEnd: number | null;
}

export function toPublicEntitlement(rec: EntitlementRecord | null): PublicEntitlement {
  if (!rec) return { plan: 'basic', billing: null, status: null, currentPeriodEnd: null };
  return {
    plan: rec.plan ?? 'basic',
    billing: rec.billing ?? null,
    status: rec.status ?? null,
    currentPeriodEnd: rec.currentPeriodEnd ?? null,
  };
}

/* ------------------------------------------------------------------------ */
/* Event handlers — used by the webhook route (and directly in tests)       */
/* ------------------------------------------------------------------------ */

export async function handleCheckoutSessionCompleted(
  store: EntitlementStore,
  session: CheckoutSessionLike,
): Promise<void> {
  const patch = computeCheckoutSessionEntitlement(session);
  if (!patch) return; // not a paid purchase for a known user
  await store.putEntitlement(patch.uid, patch);
}

export async function handleSubscriptionUpdated(
  store: EntitlementStore,
  sub: SubscriptionLike,
): Promise<void> {
  const uid = sub.metadata?.uid ?? (await store.findUidBySubscription(sub.id));
  if (!uid) return; // unknown subscription — nothing to update
  const patch = computeSubscriptionEntitlement(sub);
  await store.putEntitlement(uid, patch);
}

export async function handleSubscriptionDeleted(
  store: EntitlementStore,
  sub: SubscriptionLike,
): Promise<void> {
  const uid = sub.metadata?.uid ?? (await store.findUidBySubscription(sub.id));
  if (!uid) return;
  const patch = computeSubscriptionDeleted(sub);
  await store.putEntitlement(uid, patch);
}

export async function handleInvoicePaymentFailed(
  store: EntitlementStore,
  invoice: InvoiceLike,
): Promise<void> {
  const patch = computeInvoicePaymentFailed(invoice);
  if (!patch) return;
  const uid = await store.findUidBySubscription(patch.stripeSubscriptionId as string);
  if (!uid) return;
  await store.putEntitlement(uid, patch);
}
