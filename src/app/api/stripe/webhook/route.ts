import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { getStripe, isStripeConfigured } from '@/lib/stripe/server';
import { createEntitlementStore, isAdminConfigured } from '@/lib/firebase/admin';
import { NO_STORE_HEADERS } from '@/lib/http';
import {
  handleCheckoutSessionCompleted,
  handleInvoicePaymentFailed,
  handleSubscriptionDeleted,
  handleSubscriptionUpdated,
  type CheckoutSessionLike,
  type InvoiceLike,
  type SubscriptionLike,
} from '@/lib/stripe/entitlements';

export const runtime = 'nodejs';

/**
 * Stripe webhook endpoint — the server-side source of truth for entitlement.
 *
 * Every payload is signature-verified with `STRIPE_WEBHOOK_SECRET`; unverified
 * data is never trusted. Events are applied to the Firestore entitlement
 * records idempotently: a per-event marker is written only AFTER the event was
 * applied, so Stripe retries are safe (already-processed events are answered
 * 200 without re-applying) and a failed apply is retried by Stripe.
 *
 * Missing webhook secret / admin layer → 503 (Stripe keeps retrying).
 * Bad signature → 400 (Stripe stops).
 */
export async function POST(request: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json(
      { error: 'webhook-not-configured' },
      { status: 503, headers: NO_STORE_HEADERS },
    );
  }
  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: 'stripe-not-configured' },
      { status: 503, headers: NO_STORE_HEADERS },
    );
  }
  if (!isAdminConfigured()) {
    return NextResponse.json(
      { error: 'auth-server-not-configured' },
      { status: 503, headers: NO_STORE_HEADERS },
    );
  }

  const signature = request.headers.get('stripe-signature');
  const rawBody = await request.text();
  if (!signature) {
    return NextResponse.json(
      { error: 'missing-signature' },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch {
    return NextResponse.json(
      { error: 'invalid-signature' },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  const store = createEntitlementStore();

  // Idempotency: already-processed events are acknowledged and skipped.
  if (await store.isEventProcessed(event.id)) {
    return NextResponse.json(
      { received: true, duplicate: true },
      { headers: NO_STORE_HEADERS },
    );
  }

  switch (event.type) {
    case 'checkout.session.completed':
      await handleCheckoutSessionCompleted(store, event.data.object as unknown as CheckoutSessionLike);
      break;
    case 'customer.subscription.updated':
      await handleSubscriptionUpdated(store, event.data.object as unknown as SubscriptionLike);
      break;
    case 'customer.subscription.deleted':
      await handleSubscriptionDeleted(store, event.data.object as unknown as SubscriptionLike);
      break;
    case 'invoice.payment_failed':
      await handleInvoicePaymentFailed(store, event.data.object as unknown as InvoiceLike);
      break;
    default:
      // Unrelated event types are acknowledged and ignored (never mark them
      // processed — irrelevant types can arrive again without consequence).
      return NextResponse.json({ received: true }, { headers: NO_STORE_HEADERS });
  }

  // Mark AFTER applying so a failure above lets Stripe retry the same event.
  await store.markEventProcessed(event.id);
  return NextResponse.json({ received: true }, { headers: NO_STORE_HEADERS });
}
