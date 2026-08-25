/**
 * Privacy boundary for Paddle webhook-processing failure diagnostics.
 *
 * Server-side companion to `schema.ts` (client errors): a deliberately tiny,
 * closed record written ONLY after a webhook fails. Never stored: the webhook
 * payload/body, emails, user ids, tokens, prices or any payment details — not
 * even free-form error messages. Only low-cardinality classifications:
 *   kind (failure class), eventType (allowlist), stage, safeErrorName,
 *   retry count, release tag, timestamps.
 *
 * Noise control: Paddle retries failed deliveries, so records are keyed by a
 * deterministic document id — one doc per (eventId, stage), with a retry
 * counter — and unverifiable signatures (no trusted eventId exists) collapse
 * into hourly buckets so attackers cannot flood the collection.
 */
import { createHash } from 'node:crypto';
import { SAFE_ERROR_NAMES, safeErrorName, type SafeErrorName } from './schema';

export const WEBHOOK_FAILURE_KINDS = ['processing-failed', 'invalid-signature'] as const;
export type WebhookFailureKind = (typeof WEBHOOK_FAILURE_KINDS)[number];

export const WEBHOOK_FAILURE_STAGES = ['verify', 'apply'] as const;
export type WebhookFailureStage = (typeof WEBHOOK_FAILURE_STAGES)[number];

/** Event types this integration actually processes; everything else is noise. */
const KNOWN_EVENT_TYPES = [
  'transaction.completed',
  'transaction.paid',
  'subscription.activated',
  'subscription.created',
  'subscription.updated',
  'subscription.canceled',
  'subscription.paused',
  'subscription.past_due',
] as const;

/** Allowlist an incoming eventType; unknown values collapse into one bucket. */
export function safeEventType(eventType: unknown): string {
  return typeof eventType === 'string' && (KNOWN_EVENT_TYPES as readonly string[]).includes(eventType)
    ? eventType
    : 'unknown';
}

/**
 * Deterministic, payload-free document id.
 * - processing failures: sha256(eventId|stage) — Paddle retries of the same
 *   event land on the SAME doc, so retries update a counter instead of
 *   duplicating rows.
 * - invalid signatures: no trustworthy eventId exists (verification failed),
 *   so records collapse into hourly UTC buckets — hard-capped noise.
 */
export function failureDocId(
  kind: WebhookFailureKind,
  eventId: string | null,
  stage: WebhookFailureStage,
  now = new Date(),
): string {
  if (kind === 'invalid-signature') {
    const hour = now.toISOString().slice(0, 13); // yyyy-MM-ddTHH (UTC)
    return `isig:${hour}`;
  }
  const digest = createHash('sha256').update(`${eventId ?? ''}|${stage}`).digest('hex');
  return `pf:${digest.slice(0, 32)}`;
}

export interface WebhookFailureInput {
  kind: WebhookFailureKind;
  stage: WebhookFailureStage;
  /** Error thrown during processing; only its safe class name is kept. */
  error: unknown;
  eventType?: unknown;
}

/** The closed stored-record shape (before count/updatedAt are attached). */
export interface WebhookFailureRecord {
  v: 1;
  kind: WebhookFailureKind;
  eventType: string;
  stage: WebhookFailureStage;
  errorName: SafeErrorName;
}

function isSafeErrorName(value: unknown): value is SafeErrorName {
  return typeof value === 'string' && SAFE_ERROR_NAMES.includes(value as SafeErrorName);
}

/** Read only the standard error class name; never message/stack/cause. */
export const safeServerErrorName = safeErrorName;

/** Pure record builder — the privacy boundary is regression-tested. */
export function buildWebhookFailureRecord(input: WebhookFailureInput): WebhookFailureRecord {
  return {
    v: 1,
    kind: WEBHOOK_FAILURE_KINDS.includes(input.kind) ? input.kind : 'processing-failed',
    eventType: safeEventType(input.eventType),
    stage: WEBHOOK_FAILURE_STAGES.includes(input.stage) ? input.stage : 'apply',
    errorName: safeErrorName(input.error),
  };
}

/* ------------------------------------------------------------------ */
/* Admin view helpers                                                  */
/* ------------------------------------------------------------------ */

export interface WebhookFailureRow {
  id: string;
  kind: WebhookFailureKind;
  eventType: string;
  stage: WebhookFailureStage;
  errorName: SafeErrorName;
  count: number;
  updatedAt: string; // ISO
}

export interface WebhookFailureSummary {
  windowDays: number;
  totalEvents: number; // summed retry counts
  totalRecords: number;
  invalidSignatures: number;
  truncated: boolean;
  byEventType: Array<{ value: string; count: number }>;
  latest: WebhookFailureRow[];
}

/**
 * Strict re-validator for rows read back from Firestore (mirrors the client
 * errors API): unknown/malformed docs are dropped rather than rendered.
 */
export function safeWebhookFailureRow(id: string, value: unknown): WebhookFailureRow | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const data = value as Record<string, unknown>;
  if (!WEBHOOK_FAILURE_KINDS.includes(data.kind as WebhookFailureKind)) return null;
  if (!WEBHOOK_FAILURE_STAGES.includes(data.stage as WebhookFailureStage)) return null;
  if (!isSafeErrorName(data.errorName)) return null;
  if (typeof data.eventType !== 'string' || data.eventType.length === 0 || data.eventType.length > 48) return null;
  const count =
    typeof data.count === 'number' && Number.isInteger(data.count) && data.count >= 1 && data.count <= 10_000
      ? data.count
      : null;
  if (count === null) return null;
  const updatedAt =
    typeof data.updatedAt === 'object' && data.updatedAt !== null
      ? (() => {
          const toMillis = Reflect.get(data.updatedAt as object, 'toMillis');
          if (typeof toMillis !== 'function') return null;
          const millis = toMillis.call(data.updatedAt) as unknown;
          return typeof millis === 'number' && Number.isFinite(millis) ? millis : null;
        })()
      : null;
  if (updatedAt === null) return null;
  return {
    id,
    kind: data.kind as WebhookFailureKind,
    eventType: data.eventType,
    stage: data.stage as WebhookFailureStage,
    errorName: data.errorName,
    count,
    updatedAt: new Date(updatedAt).toISOString(),
  };
}

/** Aggregation for the admin UI; rows are already sanitized. */
export function summarizeWebhookFailures(
  rows: WebhookFailureRow[],
  options: { windowDays?: number; truncated?: boolean } = {},
): WebhookFailureSummary {
  const counts = new Map<string, number>();
  let totalEvents = 0;
  let invalidSignatures = 0;
  for (const row of rows) {
    totalEvents += row.count;
    if (row.kind === 'invalid-signature') invalidSignatures += row.count;
    counts.set(row.eventType, (counts.get(row.eventType) ?? 0) + row.count);
  }
  return {
    windowDays: options.windowDays ?? 7,
    totalEvents,
    totalRecords: rows.length,
    invalidSignatures,
    truncated: options.truncated ?? false,
    byEventType: [...counts.entries()]
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value)),
    latest: [...rows]
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, 20),
  };
}
