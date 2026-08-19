import { NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { consumeDistributedRateLimit, rateLimitClientKey } from '@/lib/distributedRateLimit';
import { getAdminDb, isAdminConfigured } from '@/lib/firebase/admin';
import { NO_STORE_HEADERS } from '@/lib/http';

export const runtime = 'nodejs';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  if (!isAdminConfigured()) return NextResponse.json({ error: 'server-not-configured' }, { status: 503, headers: NO_STORE_HEADERS });
  const body = await request.json().catch(() => null) as { email?: string } | null;
  const email = body?.email?.trim().toLowerCase() ?? '';
  if (!EMAIL_RE.test(email) || email.length > 254) return NextResponse.json({ error: 'invalid-email' }, { status: 400, headers: NO_STORE_HEADERS });
  const clientKey = rateLimitClientKey(request, email);
  if (await consumeDistributedRateLimit({ key: `newsletter:${clientKey}`, limit: 3, windowMs: 60 * 60_000 }) === 'limited') return NextResponse.json({ error: 'rate-limited' }, { status: 429, headers: NO_STORE_HEADERS });
  await getAdminDb().doc(`newsletter_subscribers/${email}`).set({ email, source: 'landing_footer', subscribedAt: Timestamp.now() }, { merge: true });
  return NextResponse.json({ subscribed: true }, { headers: NO_STORE_HEADERS });
}
