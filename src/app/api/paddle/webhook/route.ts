import { NextResponse } from 'next/server';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import {
  getPaddle,
  isPaddleConfigured,
  resolveBillingForPrice,
  resolvePlanForPrice,
} from '@/lib/paddle/server';
import { createEntitlementStore, getAdminDb, isAdminConfigured } from '@/lib/firebase/admin';
import { NO_STORE_HEADERS } from '@/lib/http';
import {
  handlePaddleAdjustmentEvent,
} from '@/lib/stripe/entitlements';
import {
  buildWebhookFailureRecord,
  failureDocId,
  safeEventType,
  type WebhookFailureKind,
  type WebhookFailureStage,
} from '@/lib/errorMonitoring/webhookFailures';
import { pruneExpiredDiagnostics } from '@/lib/errorMonitoring/retention';
import {
  handlePaddleSubscriptionEvent,
  handlePaddleTransactionCompleted,
  type PaddleAdjustmentLike,
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

const FAILURE_COLLECTION = 'webhook_failures';
const RETENTION_MS = 30 * 24 * 60 * 60 * 1_000;

/**
 * Record a bounded, sanitized webhook-processing failure for the admin
 * error-diagnostics UI. Stores ONLY safe classifications (kind, allowlisted
 * event type, stage, safe error class) — never the payload, signature header,
 * emails or payment details. Retries of the same event collapse into one
 * document via a deterministic id and a retry counter. Monitoring can never
 * break webhook processing (or change its response): all errors are swallowed.
 */
async function recordWebhookFailure(
  kind: WebhookFailureKind,
  stage: WebhookFailureStage,
  eventId: string | null,
  eventType: unknown,
  error: unknown,
): Promise<void> {
  try {
    if (!isAdminConfigured()) return;
    const record = buildWebhookFailureRecord({ kind, stage, error, eventType });
    const db = getAdminDb();
    await db
      .collection(FAILURE_COLLECTION)
      .doc(failureDocId(kind, eventId, stage))
      .set(
        {
          ...record,
          count: FieldValue.increment(1),
          updatedAt: Timestamp.now(),
          expiresAt: Timestamp.fromMillis(Date.now() + RETENTION_MS),
        },
        { merge: true },
      );
    // Billing-free fallback for TTL. Never let this best-effort cleanup alter
    // Paddle's webhook response or retry behavior.
    await pruneExpiredDiagnostics(db, FAILURE_COLLECTION).catch(() => {});
  } catch {
    // Observability must never alter the webhook contract.
  }
}

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
    await recordWebhookFailure('invalid-signature', 'verify', null, 'unknown', null);
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
    await recordWebhookFailure('invalid-signature', 'verify', null, 'unknown', null);
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
      // Subscription lifecycle — active/trialing grants Pro, past_due keeps
      // it until the paid period ends (dunning grace, enforced at read time),
      // paused/canceled/expired revoke. subscription.canceled/paused/past_due
      // are the cancellation and payment-failure signals.
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
      // Refunds / chargebacks against an original purchase. Revokes a refunded
      // Lifetime; chargebacks revoke Pro immediately (plain subscription
      // refunds stay governed by the subscription lifecycle above).
      case 'adjustment.created':
      case 'adjustment.updated':
        await handlePaddleAdjustmentEvent(
          store,
          event.data as unknown as PaddleAdjustmentLike,
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
    // Sanitized diagnostic for the admin error page (payload never stored).
    await recordWebhookFailure('processing-failed', 'apply', event.eventId, safeEventType(event.eventType), err);
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
