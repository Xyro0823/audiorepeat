/**
 * Server-only Stripe helpers. This module must NEVER be imported from a
 * client component — it reads the server-side secret key and pulls in the
 * `stripe` SDK. Client code only ever sees the Checkout Session URL this
 * module produces.
 *
 * Follows the same "unconfigured → graceful degradation" pattern as
 * Firebase: without the env vars the checkout API returns 503 and the UI
 * keeps the honest "payments coming soon" placeholder.
 */
import Stripe from 'stripe';
import { isPlanId, type PlanId } from '@/lib/plans';

export type Billing = 'monthly' | 'annual';

function priceEnv(planId: PlanId, billing: Billing): string | undefined {
  if (planId === 'pro') {
    return billing === 'annual'
      ? process.env.STRIPE_PRICE_PRO_ANNUAL
      : process.env.STRIPE_PRICE_PRO_MONTHLY;
  }
  if (planId === 'lifetime') return process.env.STRIPE_PRICE_LIFETIME;
  return undefined; // basic is free — no Stripe price
}

/** True when the server has a Stripe secret key and the client a publishable one. */
export function isStripeConfigured(): boolean {
  return Boolean(
    process.env.STRIPE_SECRET_KEY && process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
  );
}

let stripe: Stripe | null = null;

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('stripe-not-configured');
  // No explicit apiVersion — Stripe recommends using the account default.
  if (!stripe) stripe = new Stripe(key);
  return stripe;
}

/** Resolve a plan + billing cycle to a configured Stripe Price ID (or null). */
export function priceIdFor(planId: PlanId, billing: Billing): string | null {
  const id = priceEnv(planId, billing)?.trim();
  return id && id.length > 0 ? id : null;
}

export interface CheckoutSessionResult {
  url: string;
}

/**
 * Create a Checkout Session for a paid plan. Throws on misconfiguration or a
 * Stripe error — the API route maps failures to clean HTTP responses.
 */
export async function createCheckoutSession(args: {
  planId: string;
  billing: Billing;
  origin: string;
  userId?: string;
}): Promise<CheckoutSessionResult> {
  const { planId, billing, origin, userId } = args;
  if (!isPlanId(planId) || planId === 'basic') {
    throw new Error('invalid-plan');
  }
  const priceId = priceIdFor(planId, billing);
  if (!priceId) {
    throw new Error('price-not-configured');
  }
  const session = await getStripe().checkout.sessions.create({
    mode: planId === 'lifetime' ? 'payment' : 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    // On success Stripe redirects here with the session id; the success page
    // verifies it server-side before showing the confirmation.
    success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/checkout?plan=${planId}&canceled=1`,
    metadata: { planId, billing, userId: userId ?? '' },
    customer_email: undefined, // collected by Stripe Checkout by default
  });
  if (!session.url) throw new Error('stripe-no-session-url');
  return { url: session.url };
}

/** Verify a paid Checkout Session and return the purchased plan + billing. */
export async function verifyCheckoutSession(sessionId: string): Promise<{
  planId: PlanId;
  billing: Billing;
  email?: string;
} | null> {
  if (!isStripeConfigured()) return null;
  const session = await getStripe().checkout.sessions.retrieve(sessionId);
  if (session.payment_status !== 'paid') return null;
  const planId = session.metadata?.planId;
  if (!isPlanId(planId)) return null;
  return {
    planId,
    billing: session.metadata?.billing === 'monthly' ? 'monthly' : 'annual',
    email: session.customer_details?.email ?? undefined,
  };
}
