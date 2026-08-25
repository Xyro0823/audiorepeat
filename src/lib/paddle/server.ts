/**
 * Server-only Paddle Billing helpers. This module must NEVER be imported from
 * a client component — it reads the server-side API key and pulls in the
 * `@paddle/paddle-node-sdk`. Client code only ever sees the transaction id +
 * checkout URL this module produces (the checkout itself is opened with
 * Paddle.js on the client using the public client token).
 *
 * Follows the same "unconfigured → graceful degradation" pattern as the rest
 * of the app: without the env vars the checkout API returns 503 and the UI
 * keeps the honest "payments coming soon" placeholder.
 *
 * Environment (see .env.example):
 *   PADDLE_API_KEY                 — server secret (never NEXT_PUBLIC_)
 *   NEXT_PUBLIC_PADDLE_CLIENT_TOKEN — public client token (Paddle.js)
 *   PADDLE_PRICE_PRO_MONTHLY/ANNUAL/LIFETIME — price ids for each plan
 *   PADDLE_WEBHOOK_SECRET          — webhook signature secret (server)
 *   PADDLE_ENV                     — optional: 'sandbox' | 'production'
 *                                    (defaults to production)
 */
import { Environment, Paddle } from '@paddle/paddle-node-sdk';
import { isPlanId, type PlanId } from '@/lib/plans';

export type Billing = 'monthly' | 'annual';

function priceEnv(planId: PlanId, billing: Billing): string | undefined {
  if (planId === 'pro') {
    return billing === 'annual'
      ? process.env.PADDLE_PRICE_PRO_ANNUAL
      : process.env.PADDLE_PRICE_PRO_MONTHLY;
  }
  if (planId === 'lifetime') return process.env.PADDLE_PRICE_LIFETIME;
  return undefined; // basic is free — no Paddle price
}

/** True when the server has everything needed to create real Paddle checkouts. */
export function isPaddleConfigured(): boolean {
  return Boolean(
    process.env.PADDLE_API_KEY &&
      process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN &&
      process.env.PADDLE_PRICE_PRO_MONTHLY &&
      process.env.PADDLE_PRICE_PRO_ANNUAL &&
      process.env.PADDLE_PRICE_LIFETIME,
  );
}

let paddle: Paddle | null = null;

export function getPaddle(): Paddle {
  const key = process.env.PADDLE_API_KEY;
  if (!key) throw new Error('paddle-not-configured');
  if (!paddle) {
    const environment =
      process.env.PADDLE_ENV === 'sandbox' ? Environment.sandbox : Environment.production;
    paddle = new Paddle(key, { environment });
  }
  return paddle;
}

/** Resolve a plan + billing cycle to a configured Paddle Price ID (or null). */
export function priceIdFor(planId: PlanId, billing: Billing): string | null {
  const id = priceEnv(planId, billing)?.trim();
  return id && id.length > 0 ? id : null;
}

/**
 * Map a Paddle price id (from a webhook payload) to the plan it represents.
 * Only the configured catalog prices resolve; anything else is null.
 */
export function resolvePlanForPrice(priceId: string | null | undefined): PlanId | null {
  if (!priceId) return null;
  if (priceId === process.env.PADDLE_PRICE_PRO_MONTHLY) return 'pro';
  if (priceId === process.env.PADDLE_PRICE_PRO_ANNUAL) return 'pro';
  if (priceId === process.env.PADDLE_PRICE_LIFETIME) return 'lifetime';
  return null;
}

/** Map a pro price id to its billing cycle (monthly vs annual). */
export function resolveBillingForPrice(priceId: string | null | undefined): 'monthly' | 'annual' | null {
  if (!priceId) return null;
  if (priceId === process.env.PADDLE_PRICE_PRO_MONTHLY) return 'monthly';
  if (priceId === process.env.PADDLE_PRICE_PRO_ANNUAL) return 'annual';
  return null;
}

export interface CheckoutTransactionResult {
  /** Paddle transaction id — passed to Paddle.js to open the hosted checkout. */
  transactionId: string;
  /** Hosted checkout payment-link fallback (used if Paddle.js can't load). */
  checkoutUrl: string;
}

/**
 * Create a Paddle transaction for a paid plan on behalf of an authenticated
 * user (uid is the server-verified Firebase uid — never a client-supplied
 * value). The uid travels in server-controlled `customData`; Paddle copies it
 * onto the subscription created from the transaction, so subscription lifecycle
 * webhooks can be mapped back to the same Firebase user.
 *
 * Unlike Stripe there is no separate "customer" object to create: Paddle is
 * the merchant of record and collects the customer's details inside checkout.
 *
 * Throws on misconfiguration or a Paddle error — the API route maps failures
 * to clean HTTP responses.
 */
export async function createCheckoutTransaction(args: {
  planId: string;
  billing: Billing;
  uid: string;
}): Promise<CheckoutTransactionResult> {
  const { planId, billing, uid } = args;
  if (!isPlanId(planId) || planId === 'basic') {
    throw new Error('invalid-plan');
  }
  const priceId = priceIdFor(planId, billing);
  if (!priceId) {
    throw new Error('price-not-configured');
  }

  const txn = await getPaddle().transactions.create({
    items: [{ priceId, quantity: 1 }],
    customData: { uid, planId, billing },
  });
  return {
    transactionId: txn.id,
    checkoutUrl: txn.checkout?.url ?? '',
  };
}

/**
 * Verify a completed Paddle transaction and return the purchased plan +
 * billing. Used by the success page for DISPLAY only — it never grants
 * anything; the webhook → Firestore entitlement record is the source of truth.
 * Returns null when the transaction isn't a completed purchase of a known plan.
 */
export async function verifyPaddleTransaction(transactionId: string): Promise<{
  planId: PlanId;
  billing: Billing;
  email?: string;
} | null> {
  if (!isPaddleConfigured()) return null;
  const txn = await getPaddle().transactions.get(transactionId);
  if (txn.status !== 'completed') return null;
  const priceId = txn.items?.[0]?.price?.id ?? null;
  const planId = resolvePlanForPrice(priceId);
  if (!planId) return null;
  const billing: Billing =
    planId === 'pro' ? (resolveBillingForPrice(priceId) ?? 'annual') : 'annual';
  return {
    planId,
    billing,
    email: txn.customer?.email ?? undefined,
  };
}

/**
 * Subscription statuses that still represent a live or resumable Paddle
 * subscription. `past_due`/`grace` may still bill again; `paused` can be
 * resumed and resume billing — all must be canceled before account deletion.
 * `canceled` needs no action; lifetime purchases have no subscription at all.
 */
export const LIVE_PADDLE_SUBSCRIPTION_STATUSES: ReadonlySet<string> = new Set([
  'active',
  'trialing',
  'past_due',
  'grace',
  'paused',
]);

export type PaddleCancellationResult = 'canceled' | 'failed';

/**
 * Cancel a Paddle subscription immediately. Used by the account-deletion flow:
 * billing MUST be terminated (and verified) before any user data is deleted.
 *
 * Fail-closed contract: any SDK/network error, an unexpected response status,
 * or a misconfiguration returns 'failed' — the caller must then refuse the
 * deletion and keep the account + data intact.
 */
export async function cancelPaddleSubscriptionNow(
  subscriptionId: string,
): Promise<PaddleCancellationResult> {
  try {
    const subscription = await getPaddle().subscriptions.cancel(subscriptionId, {
      effectiveFrom: 'immediately',
    });
    // Only a confirmed 'canceled' status counts as success; anything else is
    // treated as a failure so deletion never proceeds on a guess.
    return subscription?.status === 'canceled' ? 'canceled' : 'failed';
  } catch {
    return 'failed';
  }
}
