import { NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { checkoutRateLimiter } from '@/lib/analytics/rateLimit';
import { getAdminDb, isAdminConfigured, verifyIdToken } from '@/lib/firebase/admin';
import { NO_STORE_HEADERS } from '@/lib/http';
import { isPlanId } from '@/lib/plans';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  if (!isAdminConfigured()) return NextResponse.json({ error: 'server-not-configured' }, { status: 503, headers: NO_STORE_HEADERS });
  const auth = request.headers.get('authorization');
  const token = auth?.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const uid = token ? await verifyIdToken(token) : null;
  if (!uid) return NextResponse.json({ error: 'unauthenticated' }, { status: 401, headers: NO_STORE_HEADERS });
  if (checkoutRateLimiter.consume(`interest:${uid}`) === 'limited') return NextResponse.json({ error: 'rate-limited' }, { status: 429, headers: NO_STORE_HEADERS });
  const body = await request.json().catch(() => null) as { plan?: string; billing?: string } | null;
  if (!body || !isPlanId(body.plan) || body.plan === 'basic' || !['monthly', 'annual'].includes(body.billing ?? '')) return NextResponse.json({ error: 'invalid-body' }, { status: 400, headers: NO_STORE_HEADERS });
  await getAdminDb().doc(`plan_interest/${uid}_${body.plan}_${body.billing}`).set({ userId: uid, plan: body.plan, billing: body.billing, source: 'checkout', recordedAt: Timestamp.now() }, { merge: true });
  return NextResponse.json({ recorded: true }, { headers: NO_STORE_HEADERS });
}
