import { Timestamp } from 'firebase-admin/firestore';
import { NextResponse } from 'next/server';
import { getAdminDb, verifyAdminRequest } from '@/lib/firebase/admin';
import { NO_STORE_HEADERS } from '@/lib/http';

export const runtime = 'nodejs';

const COLLECTION = 'translation_reports';
const QUERY_LIMIT = 100;
const LANGUAGE_RE = /^[a-z]{2,3}(?:-[a-z]{2})?$/;
const DOC_ID_RE = /^[A-Za-z0-9_-]{8,128}$/;
const REVIEW_STATUSES = ['approved', 'rejected'] as const;

type ReviewStatus = (typeof REVIEW_STATUSES)[number];

type TranslationReport = {
  id: string;
  language: string;
  target: string;
  currentTranslation: string;
  suggestion: string;
  createdAt: string;
};

function timestampIso(value: unknown): string | null {
  if (typeof value !== 'object' || value === null) return null;
  const toMillis = Reflect.get(value, 'toMillis');
  if (typeof toMillis !== 'function') return null;
  const millis = toMillis.call(value) as unknown;
  return typeof millis === 'number' && Number.isFinite(millis) ? new Date(millis).toISOString() : null;
}

function isShortText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= 240;
}

function safeReport(id: string, value: unknown): TranslationReport | null {
  if (!DOC_ID_RE.test(id) || typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const data = value as Record<string, unknown>;
  if (data.status !== 'open' || typeof data.language !== 'string' || !LANGUAGE_RE.test(data.language)) return null;
  if (!isShortText(data.target) || !isShortText(data.currentTranslation) || !isShortText(data.suggestion)) return null;
  const createdAt = timestampIso(data.createdAt);
  if (!createdAt) return null;
  return {
    id,
    language: data.language,
    target: data.target,
    currentTranslation: data.currentTranslation,
    suggestion: data.suggestion,
    createdAt,
  };
}

/** Admin-only queue of open community translation corrections. */
export async function GET(request: Request) {
  const auth = await verifyAdminRequest(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status, headers: NO_STORE_HEADERS });
  }

  try {
    const snap = await getAdminDb()
      .collection(COLLECTION)
      .orderBy('createdAt', 'desc')
      .limit(QUERY_LIMIT)
      .get();
    const reports = snap.docs
      .map((doc) => safeReport(doc.id, doc.data()))
      .filter((report): report is TranslationReport => report !== null);
    return NextResponse.json({ reports }, { headers: NO_STORE_HEADERS });
  } catch {
    return NextResponse.json({ error: 'reports-unavailable' }, { status: 500, headers: NO_STORE_HEADERS });
  }
}

/** Mark a correction as approved or rejected. The actual vocabulary stays unchanged until curated separately. */
export async function PATCH(request: Request) {
  const auth = await verifyAdminRequest(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status, headers: NO_STORE_HEADERS });
  }

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const id = body?.id;
  const status = body?.status;
  if (typeof id !== 'string' || !DOC_ID_RE.test(id) || !REVIEW_STATUSES.includes(status as ReviewStatus)) {
    return NextResponse.json({ error: 'invalid-request' }, { status: 400, headers: NO_STORE_HEADERS });
  }

  try {
    await getAdminDb().collection(COLLECTION).doc(id).update({
      status: status as ReviewStatus,
      reviewedAt: Timestamp.fromMillis(Date.now()),
    });
    return NextResponse.json({ ok: true }, { headers: NO_STORE_HEADERS });
  } catch {
    return NextResponse.json({ error: 'report-not-found' }, { status: 404, headers: NO_STORE_HEADERS });
  }
}
