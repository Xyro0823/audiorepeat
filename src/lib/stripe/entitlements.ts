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

/**
 * A server-admin-managed grant (gift / tester / creator / support), entirely
 * independent of billing. It lives in its own `manual` field on the record so
 * provider (Paddle/Stripe) events can never accidentally erase it.
 *
 * Expiry is computed at read time (see `isManualActive`) — expiring a gift
 * never requires deleting data.
 */
export interface ManualEntitlement {
  /** The granted level: 'pro' or 'lifetime'. */
  plan: 'pro' | 'lifetime';
  /** Optional human-readable reason (e.g. "Creator gift"). Never shown publicly. */
  reason: string | null;
  /** Unix seconds when the grant expires; null = never. */
  expiresAt: number | null;
  /** Unix seconds when granted. */
  grantedAt: number;
  /** Admin uid who granted it. */
  grantedBy: string | null;
  /** Unix seconds when revoked; null = not revoked (kept for audit). */
  revokedAt: number | null;
  /** Admin uid who revoked it. */
  revokedBy: string | null;
}

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
  /** Paddle subscription id (Paddle webhook path). Optional — Stripe records never set it. */
  paddleSubscriptionId?: string | null;
  /** The current Paddle price id (Paddle webhook path). Optional — Stripe records never set it. */
  paddlePriceId?: string | null;
  /** Stripe subscription status ('active', 'trialing', 'past_due', …) or 'active' for Lifetime. */
  status: string;
  /** Unix seconds when the current billing period ends (subscriptions only). */
  currentPeriodEnd: number | null;
  /**
   * Server-admin-managed grant (gift/comp/support), if any. Written only by
   * the admin grant/revoke API — provider webhook events preserve it.
   * Optional so legacy records (pre-manual) stay valid.
   */
  manual?: ManualEntitlement | null;
  /** Server timestamp of the last write. */
  updatedAt: unknown;
}

/** Persistence boundary — implemented by the Firestore store in admin.ts. */
export interface EntitlementStore {
  getEntitlement(uid: string): Promise<EntitlementRecord | null>;
  putEntitlement(uid: string, patch: Partial<EntitlementRecord>): Promise<void>;
  /** Map a Stripe subscription id back to the owning uid (for events whose payload lacks metadata). */
  findUidBySubscription(stripeSubscriptionId: string): Promise<string | null>;
  /**
   * Map a Paddle subscription id back to the owning uid. Optional — the
   * Paddle path normally carries the uid in custom data, this is a fallback.
   */
  findUidByPaddleSubscription?(paddleSubscriptionId: string): Promise<string | null>;
  /** Idempotency markers for processed webhook events (collection chosen by the store). */
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
/* Paddle Billing payload shapes + price resolution                          */
/* ------------------------------------------------------------------------ */

/** The minimal subset of a Paddle transaction webhook payload we read. */
export interface PaddleTransactionLike {
  id: string;
  status?: string | null;
  /** Server-set custom data: { uid, planId, billing } — the uid is authoritative. */
  customData?: Record<string, unknown> | null;
  items?: { price?: { id?: string | null } | null }[] | null;
  /** Set when the transaction created a subscription (Pro purchases). */
  subscriptionId?: string | null;
}

/** The minimal subset of a Paddle subscription webhook payload we read. */
export interface PaddleSubscriptionLike {
  id: string;
  status?: string | null;
  customData?: Record<string, unknown> | null;
  items?: { price?: { id?: string | null } | null }[] | null;
  currentBillingPeriod?: { endsAt?: string | null } | null;
}

/**
 * Maps a Paddle price id to plan + billing. Injected by callers (the webhook
 * route passes the env-driven resolver from `@/lib/paddle/server`) so this
 * module stays free of `process.env` and remains unit-testable.
 */
export interface PaddlePriceResolver {
  resolvePlan(priceId: string | null | undefined): PlanId | null;
  resolveBilling(priceId: string | null | undefined): 'monthly' | 'annual' | null;
}

/** Paddle subscription statuses that keep Pro entitlement active. */
const PADDLE_ENTITLED_SUBSCRIPTION_STATUSES = new Set(['active', 'trialing']);

/* ------------------------------------------------------------------------ */
/* Manual grants + effective entitlement                                     */
/* ------------------------------------------------------------------------ */

/** True while a manual grant is valid (not revoked and not expired). */
export function isManualActive(manual: ManualEntitlement, nowSec: number): boolean {
  if (manual.revokedAt !== null) return false;
  if (manual.expiresAt !== null && nowSec >= manual.expiresAt) return false;
  return true;
}

/** The computed plan a user is entitled to right now. */
export interface EffectiveEntitlement {
  plan: PlanId;
  billing: EntitlementBilling;
  status: string | null;
  currentPeriodEnd: number | null;
}

const FREE_ENTITLEMENT: EffectiveEntitlement = {
  plan: 'basic',
  billing: null,
  status: null,
  currentPeriodEnd: null,
};

/**
 * Compute the effective entitlement from a record using
 * "strongest valid entitlement wins" semantics:
 *
 *   Lifetime (any source) > active manual Pro > active provider subscription > Free
 *
 * The flat fields (`plan`/`billing`/`status`/`currentPeriodEnd`) are provider
 * state, written only by webhook events. Manual grants live in `manual` and
 * are never overwritten by provider events, so a Paddle cancellation or
 * payment failure can never revoke an active manual grant (or Lifetime).
 * Expiry is evaluated here, at read time — no cleanup job required.
 */
export function computeEffectiveEntitlement(
  rec: EntitlementRecord | null,
  nowSec: number,
): EffectiveEntitlement {
  if (!rec) return FREE_ENTITLEMENT;

  const manualActive = rec.manual ? isManualActive(rec.manual, nowSec) : false;

  // 1) Lifetime from any source wins everything.
  if (manualActive && rec.manual?.plan === 'lifetime') {
    return { plan: 'lifetime', billing: 'lifetime', status: 'active', currentPeriodEnd: null };
  }
  // Provider Lifetime (billing === 'lifetime' is only ever written by a
  // lifetime purchase; manual grants never touch the flat fields).
  if (rec.plan === 'lifetime' && rec.billing === 'lifetime') {
    return { plan: 'lifetime', billing: 'lifetime', status: 'active', currentPeriodEnd: null };
  }

  // 2) An active manual Pro (gift) beats an active provider subscription.
  if (manualActive && rec.manual?.plan === 'pro') {
    return { plan: 'pro', billing: null, status: 'active', currentPeriodEnd: null };
  }

  // 3) Active provider subscription (Stripe or Paddle). The flat plan is only
  //    ever 'pro' when a provider event wrote it, so this is unambiguous.
  const providerSubActive = rec.status === 'active' || rec.status === 'trialing';
  if (
    providerSubActive &&
    (Boolean(rec.paddleSubscriptionId || rec.stripeSubscriptionId) || rec.plan === 'pro')
  ) {
    return {
      plan: 'pro',
      billing: rec.billing ?? null,
      status: rec.status ?? null,
      currentPeriodEnd: rec.currentPeriodEnd ?? null,
    };
  }

  return FREE_ENTITLEMENT;
}

/**
 * The effective entitlement plus which source drives it — shared by
 * `/api/entitlement` (user-facing) and the admin lookup endpoint.
 * `manualExpiresAt` is only set when an active manual grant actually drives
 * the current plan.
 */
export interface EffectiveEntitlementView extends EffectiveEntitlement {
  /** 'manual' (server-admin gift) vs 'paddle' (verified billing) vs null (Free). */
  source: 'manual' | 'paddle' | null;
  /** When the driving manual grant expires (null = never / not manual-driven). */
  manualExpiresAt: number | null;
}

export function effectiveEntitlementView(
  rec: EntitlementRecord | null,
  nowSec: number,
): EffectiveEntitlementView {
  const effective = computeEffectiveEntitlement(rec, nowSec);
  const manualActive = Boolean(rec?.manual && isManualActive(rec.manual, nowSec));
  const manualDrives =
    manualActive &&
    ((effective.plan === 'pro' && rec?.manual?.plan === 'pro') ||
      (effective.plan === 'lifetime' && rec?.manual?.plan === 'lifetime'));
  return {
    ...effective,
    source: effective.plan === 'basic' ? null : manualDrives ? 'manual' : 'paddle',
    manualExpiresAt: manualDrives && rec?.manual ? rec.manual.expiresAt : null,
  };
}

/**
 * What the provider (Paddle/Stripe) alone would grant — used by the admin UI
 * to show whether a user is also a paying subscriber under a gift.
 */
export function providerPlanOf(rec: EntitlementRecord | null, nowSec: number): PlanId {
  if (!rec) return 'basic';
  return computeEffectiveEntitlement({ ...rec, manual: null }, nowSec).plan;
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

/* ------------------------------------------------------------------------ */
/* Paddle computations                                                      */
/* ------------------------------------------------------------------------ */

/**
 * Derive the entitlement patch for a completed Paddle transaction
 * (`transaction.completed` / `transaction.paid`). Returns null when the event
 * should be ignored (not completed, missing uid, unknown price).
 *
 * - Lifetime price → permanent Lifetime entitlement (no subscription).
 * - Pro price → Pro entitlement (the transaction's first payment captured the
 *   subscription); ongoing lifecycle is refined by subscription events.
 */
export function computePaddleTransactionEntitlement(
  txn: PaddleTransactionLike,
  prices: PaddlePriceResolver,
): Omit<EntitlementRecord, 'updatedAt'> | null {
  const uid = txn.customData?.uid;
  if (typeof uid !== 'string' || uid.length === 0) return null;
  if (txn.status !== 'completed') return null;

  const priceId = txn.items?.[0]?.price?.id ?? null;
  const plan = prices.resolvePlan(priceId);
  if (!plan) return null;

  if (plan === 'lifetime') {
    return {
      uid,
      plan: 'lifetime',
      billing: 'lifetime',
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      stripePriceId: null,
      paddleSubscriptionId: null,
      paddlePriceId: priceId,
      status: 'active',
      currentPeriodEnd: null,
    };
  }
  // Pro — the checkout created a subscription; capture its id for lifecycle
  // mapping (the exact billing comes from the price resolver).
  return {
    uid,
    plan: 'pro',
    billing: prices.resolveBilling(priceId) ?? 'annual',
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    stripePriceId: null,
    paddleSubscriptionId: txn.subscriptionId ?? null,
    paddlePriceId: priceId,
    status: 'active',
    currentPeriodEnd: null,
  };
}

/**
 * Derive the entitlement patch for a Paddle subscription event
 * (`subscription.activated` / `updated` / `canceled` / `paused` / `past_due`).
 * Active/trialing keeps Pro (with refreshed period + price); every other
 * status revokes Pro back to Free.
 */
export function computePaddleSubscriptionEntitlement(
  sub: PaddleSubscriptionLike,
  prices: PaddlePriceResolver,
): Omit<
  EntitlementRecord,
  'updatedAt' | 'uid' | 'stripeCustomerId' | 'stripeSubscriptionId' | 'stripePriceId'
> {
  const status = sub.status ?? 'active';
  const priceId = sub.items?.[0]?.price?.id ?? null;
  const currentPeriodEnd = sub.currentBillingPeriod?.endsAt
    ? Math.floor(Date.parse(sub.currentBillingPeriod.endsAt) / 1000)
    : null;

  if (PADDLE_ENTITLED_SUBSCRIPTION_STATUSES.has(status)) {
    return {
      plan: 'pro',
      billing: prices.resolveBilling(priceId) ?? null,
      paddleSubscriptionId: sub.id,
      paddlePriceId: priceId,
      status,
      currentPeriodEnd,
    };
  }
  // Not entitled — revoke Pro but keep the subscription id + status for history.
  return {
    plan: 'basic',
    billing: null,
    paddleSubscriptionId: sub.id,
    paddlePriceId: priceId,
    status,
    currentPeriodEnd,
  };
}

/* ------------------------------------------------------------------------ */
/* Paddle event handlers                                                    */
/* ------------------------------------------------------------------------ */

/**
 * Apply a `transaction.completed` / `transaction.paid` event.
 *
 * Lifetime protection: if the user already owns Lifetime, a later Pro
 * purchase keeps Lifetime (the strongest entitlement always wins).
 */
export async function handlePaddleTransactionCompleted(
  store: EntitlementStore,
  txn: PaddleTransactionLike,
  prices: PaddlePriceResolver,
): Promise<void> {
  const patch = computePaddleTransactionEntitlement(txn, prices);
  if (!patch) return;
  const current = await store.getEntitlement(patch.uid);
  // Lifetime is permanent — a later purchase never downgrades it (and a
  // redundant purchase for an existing Lifetime owner changes nothing).
  if (current?.plan === 'lifetime' || current?.billing === 'lifetime') return;
  // Preserve the manual grant (if any) — a purchase never erases a gift.
  await store.putEntitlement(patch.uid, { ...patch, manual: current?.manual ?? null });
}

/**
 * Apply a Paddle subscription lifecycle event
 * (`subscription.activated` / `created` / `updated` / `canceled` / `paused` /
 * `past_due`). Active/trialing → Pro; anything else revokes. A revoke NEVER
 * touches an account that already owns Lifetime.
 */
export async function handlePaddleSubscriptionEvent(
  store: EntitlementStore,
  sub: PaddleSubscriptionLike,
  prices: PaddlePriceResolver,
): Promise<void> {
  const uid =
    (typeof sub.customData?.uid === 'string' && sub.customData.uid.length > 0
      ? sub.customData.uid
      : null) ?? (await store.findUidByPaddleSubscription?.(sub.id)) ?? null;
  if (!uid) return; // unknown subscription — nothing to update

  const patch = computePaddleSubscriptionEntitlement(sub, prices);
  const current = await store.getEntitlement(uid);
  if (current?.plan === 'lifetime' || current?.billing === 'lifetime') {
    // Lifetime is permanent — a subscription lifecycle event never downgrades
    // it. A would-be Pro grant keeps Lifetime (strongest wins) while still
    // refreshing the subscription state for history.
    if (patch.plan === 'pro') {
      await store.putEntitlement(uid, {
        ...patch,
        uid,
        plan: 'lifetime',
        billing: 'lifetime',
        manual: current.manual ?? null,
      });
    }
    return; // revokes don't touch a Lifetime owner
  }
  // Nothing to revoke when the user has no record yet — a payment-failure or
  // cancellation event for an unknown subscription never creates one.
  if (!current && patch.plan === 'basic') return;
  // Provider state (status, ids, period end) is recorded as-is, but an active
  // manual grant keeps the effective plan — computeEffectiveEntitlement ranks
  // the manual grant above provider state at read time, so a cancellation or
  // payment failure can never revoke a gift.
  await store.putEntitlement(uid, { ...patch, uid, manual: current?.manual ?? null });
}
