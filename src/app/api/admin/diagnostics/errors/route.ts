import { Timestamp } from 'firebase-admin/firestore';
import { NextResponse } from 'next/server';
import { summarizeErrorEvents, type AdminErrorEvent } from '@/lib/errorMonitoring/admin';
import {
  ERROR_AREAS,
  ERROR_SOURCES,
  SAFE_ERROR_NAMES,
  type ErrorArea,
  type ErrorSource,
  type ErrorVisibility,
  type SafeErrorName,
} from '@/lib/errorMonitoring/schema';
import {
  safeWebhookFailureRow,
  summarizeWebhookFailures,
} from '@/lib/errorMonitoring/webhookFailures';
import { getAdminDb, verifyAdminRequest } from '@/lib/firebase/admin';
import { NO_STORE_HEADERS } from '@/lib/http';

export const runtime = 'nodejs';

const ERROR_COLLECTION = 'client_errors';
const WEBHOOK_FAILURE_COLLECTION = 'webhook_failures';
const WINDOW_DAYS = 7;
const QUERY_LIMIT = 500;

function timestampIso(value: unknown): string | null {
  if (typeof value !== 'object' || value === null) return null;
  const toMillis = Reflect.get(value, 'toMillis');
  if (typeof toMillis !== 'function') return null;
  const millis = toMillis.call(value) as unknown;
  return typeof millis === 'number' && Number.isFinite(millis) ? new Date(millis).toISOString() : null;
}

function safeEvent(id: string, value: unknown): AdminErrorEvent | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const data = value as Record<string, unknown>;
  if (!ERROR_SOURCES.includes(data.source as ErrorSource)) return null;
  if (!ERROR_AREAS.includes(data.area as ErrorArea)) return null;
  if (!SAFE_ERROR_NAMES.includes(data.errorName as SafeErrorName)) return null;
  if (typeof data.online !== 'boolean') return null;
  if (!['visible', 'hidden', 'prerender'].includes(data.visibility as string)) return null;
  if (typeof data.fingerprint !== 'string' || !/^[0-9a-f]{24}$/.test(data.fingerprint)) return null;
  if (typeof data.release !== 'string' || !/^(local|[0-9a-f]{7,12})$/.test(data.release)) return null;
  const createdAt = timestampIso(data.createdAt);
  if (!createdAt) return null;
  return {
    id,
    source: data.source as ErrorSource,
    area: data.area as ErrorArea,
    errorName: data.errorName as SafeErrorName,
    online: data.online,
    visibility: data.visibility as ErrorVisibility,
    fingerprint: data.fingerprint,
    release: data.release,
    createdAt,
  };
}

/** Admin-only, read-only 7-day error summary and recent sanitized events. */
export async function GET(request: Request) {
  const auth = await verifyAdminRequest(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status, headers: NO_STORE_HEADERS });
  }
  const db = getAdminDb();
  try {
    const since = Timestamp.fromMillis(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1_000);
    const snap = await db
      .collection(ERROR_COLLECTION)
      .where('createdAt', '>=', since)
      .orderBy('createdAt', 'desc')
      .limit(QUERY_LIMIT)
      .get();
    const events = snap.docs
      .map((doc) => safeEvent(doc.id, doc.data()))
      .filter((event): event is AdminErrorEvent => event !== null);
    // Webhook failures are best-effort: an empty/failed read degrades to a
    // healthy empty summary instead of hiding the client-error diagnostics.
    let paddleWebhook = summarizeWebhookFailures([], { windowDays: WINDOW_DAYS });
    try {
      const wfSnap = await db
        .collection(WEBHOOK_FAILURE_COLLECTION)
        .where('updatedAt', '>=', since)
        .limit(QUERY_LIMIT)
        .get();
      const rows = wfSnap.docs
        .map((doc) => safeWebhookFailureRow(doc.id, doc.data()))
        .filter((row): row is NonNullable<typeof row> => row !== null);
      paddleWebhook = summarizeWebhookFailures(rows, {
        windowDays: WINDOW_DAYS,
        truncated: wfSnap.size >= QUERY_LIMIT,
      });
    } catch {
      // keep the empty webhook summary
    }
    return NextResponse.json(
      {
        summary: summarizeErrorEvents(events, { windowDays: WINDOW_DAYS, truncated: snap.size >= QUERY_LIMIT }),
        paddleWebhook,
      },
      { headers: NO_STORE_HEADERS },
    );
  } catch {
    return NextResponse.json({ error: 'diagnostics-unavailable' }, { status: 500, headers: NO_STORE_HEADERS });
  }
}
