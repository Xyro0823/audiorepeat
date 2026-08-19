import { NextResponse } from 'next/server';
import {
  getPaddle,
  isPaddleConfigured,
  resolveBillingForPrice,
  resolvePlanForPrice,
} from '@/lib/paddle/server';
import { createEntitlementStore, isAdminConfigured } from '@/lib/firebase/admin';
import { NO_STORE_HEADERS } from '@/lib/http';
import {
  handlePaddleSubscriptionEvent,
  handlePaddleTransactionCompleted,
  type PaddlePriceResolver,
  type PaddleSubscriptionLike,
  type PaddleTransactionLike,
} from '@/lib/stripe/entitlements';

export const runtime = 'nodejs';

/** Price resolution for webhook payloads — driven by the configured catalog. */
const PRICES: PaddlePriceResolver = {
  resolvePlan: resolvePlanForPrice,
  resolveBilling: resolveBillingForPrice,
};

/**
 * Paddle webhook endpoint — the server-side source of truth for entitlement.
 *
 * Every payload is signature-verified with `PADDLE_WEBHOOK_SECRET` using
 * Paddle's official verification (the raw request body is fed to
 * `paddle.webhooks.unmarshal` — it is never parsed/re-serialized first).
 * Unverified data is never trusted.
 *
 * Events are applied to the Firestore entitlement records idempotently: a
 * per-event marker in `paddle_events/{eventId}` is written only AFTER the
 * event was applied, so Paddle retries are safe (already-processed events are
 * answered 200 without re-applying) and a failed apply is retried.
 *
 * Missing webhook secret / Paddle config / admin layer → 503 (Paddle retries).
 * Bad signature → 400 (Paddle stops).
 */
export async function POST(request: Request) {
  const webhookSecret = process.env.PADDLE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json(
      { error: 'webhook-not-configured' },
      { status: 503, headers: NO_STORE_HEADERS },
    );
  }
  if (!isPaddleConfigured()) {
    return NextResponse.json(
      { error: 'paddle-not-configured' },
      { status: 503, headers: NO_STORE_HEADERS },
    );
  }
  if (!isAdminConfigured()) {
    return NextResponse.json(
      { error: 'auth-server-not-configured' },
      { status: 503, headers: NO_STORE_HEADERS },
    );
  }

  const signature = request.headers.get('paddle-signature');
  const rawBody = await request.text();
  if (!signature) {
    return NextResponse.json(
      { error: 'missing-signature' },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  let event: { eventId: string; eventType: string; occurredAt?: string; data: object };
  try {
    // Official verification: validates ts/h1 over the RAW body, then parses.
    event = (await getPaddle().webhooks.unmarshal(rawBody, webhookSecret, signature)) as {
      eventId: string;
      eventType: string;
      occurredAt?: string;
      data: object;
    };
  } catch {
    return NextResponse.json(
      { error: 'invalid-signature' },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  const store = createEntitlementStore({ events: 'paddle' });

  // Idempotency: already-processed events are acknowledged and skipped.
  if (await store.isEventProcessed(event.eventId)) {
    return NextResponse.json({ received: true, duplicate: true }, { headers: NO_STORE_HEADERS });
  }

  try {
    switch (event.eventType) {
      // Successful purchase — Pro (subscription first payment) or Lifetime.
      case 'transaction.completed':
      case 'transaction.paid':
        await handlePaddleTransactionCompleted(
          store,
          event.data as unknown as PaddleTransactionLike,
          PRICES,
          event.occurredAt ? Date.parse(event.occurredAt) : undefined,
        );
        break;
      // Subscription lifecycle — active/trialing grants Pro, everything else
      // revokes. subscription.canceled/paused/past_due are the cancellation
      // and payment-failure signals.
      case 'subscription.activated':
      case 'subscription.created':
      case 'subscription.updated':
      case 'subscription.canceled':
      case 'subscription.paused':
      case 'subscription.past_due':
        await handlePaddleSubscriptionEvent(
          store,
          event.data as unknown as PaddleSubscriptionLike,
          PRICES,
          event.occurredAt ? Date.parse(event.occurredAt) : undefined,
        );
        break;
      default:
        // Unrelated event types are acknowledged and ignored (never mark them
        // processed — irrelevant types can arrive again without consequence).
        return NextResponse.json({ received: true }, { headers: NO_STORE_HEADERS });
    }
  } catch (err) {
    console.error('[paddle-webhook] event processing failed:', err);
    // 5xx → Paddle retries the same event (the marker was NOT written).
    return NextResponse.json(
      { error: 'processing-failed' },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }

  // Mark AFTER applying so a failure above lets Paddle retry the same event.
  await store.markEventProcessed(event.eventId);
  return NextResponse.json({ received: true }, { headers: NO_STORE_HEADERS });
}
