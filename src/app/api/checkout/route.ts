import { NextResponse } from 'next/server';
import { createCheckoutTransaction, isPaddleConfigured, type Billing } from '@/lib/paddle/server';
import { isAdminConfigured, verifyIdToken } from '@/lib/firebase/admin';
import { NO_STORE_HEADERS } from '@/lib/http';
import { isPlanId } from '@/lib/plans';
import { checkoutRateLimiter } from '@/lib/analytics/rateLimit';

export const runtime = 'nodejs';

/** Extract a Bearer token from the Authorization header, if present. */
function bearerToken(request: Request): string | null {
  const auth = request.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  const token = auth.slice('Bearer '.length).trim();
  return token.length > 0 ? token : null;
}

/**
 * Create a Paddle transaction for the selected paid plan.
 *
 * The caller MUST be an authenticated Firebase user: the client sends their
 * ID token as `Authorization: Bearer <idToken>`, it is verified server-side
 * with firebase-admin, and the verified uid is placed in the transaction's
 * server-controlled `customData` (copied to the created subscription). A
 * client-supplied `userId` in the body is never trusted.
 *
 * The client then opens the Paddle hosted checkout (overlay) for the returned
 * transaction id using Paddle.js; on completion the customer is redirected to
 * /checkout/success and the /api/paddle/webhook grants entitlement.
 *
 * When Paddle or the admin layer isn't configured, this returns 503 and the
 * UI keeps the honest placeholder + free-access fallback.
 */
export async function POST(request: Request) {
  if (!isPaddleConfigured()) {
    return NextResponse.json({ error: 'paddle-not-configured' }, { status: 503, headers: NO_STORE_HEADERS });
  }
  if (!isAdminConfigured()) {
    return NextResponse.json(
      { error: 'auth-server-not-configured', message: 'Server-side auth is not configured yet.' },
      { status: 503, headers: NO_STORE_HEADERS },
    );
  }

  const token = bearerToken(request);
  if (!token) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401, headers: NO_STORE_HEADERS });
  }
  // The uid is derived from the verified token — the body never contributes
  // identity (a spoofed `userId` payload is ignored by simply not reading it).
  const uid = await verifyIdToken(token);
  if (!uid) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401, headers: NO_STORE_HEADERS });
  }
  if (checkoutRateLimiter.consume(uid) === 'limited') {
    return NextResponse.json(
      { error: 'rate-limited', message: 'Too many checkout attempts. Please try again later.' },
      { status: 429, headers: { ...NO_STORE_HEADERS, 'Retry-After': '600' } },
    );
  }

  let body: { planId?: string; billing?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid-body' }, { status: 400, headers: NO_STORE_HEADERS });
  }

  const { planId } = body;
  if (body.billing !== 'monthly' && body.billing !== 'annual') {
    return NextResponse.json({ error: 'invalid-billing' }, { status: 400, headers: NO_STORE_HEADERS });
  }
  const billing: Billing = body.billing;

  if (!isPlanId(planId) || planId === 'basic') {
    return NextResponse.json({ error: 'invalid-plan' }, { status: 400, headers: NO_STORE_HEADERS });
  }

  try {
    const { transactionId, checkoutUrl } = await createCheckoutTransaction({
      planId,
      billing,
      uid,
    });
    return NextResponse.json({ transactionId, checkoutUrl }, { headers: NO_STORE_HEADERS });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'checkout-failed';
    if (message === 'price-not-configured') {
      return NextResponse.json(
        { error: 'price-not-configured', message: 'This plan has no Paddle price configured yet.' },
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }
    if (message === 'firebase-admin-not-configured') {
      return NextResponse.json(
        { error: 'auth-server-not-configured', message: 'Server-side auth is not configured yet.' },
        { status: 503, headers: NO_STORE_HEADERS },
      );
    }
    console.error('[checkout] create transaction failed:', message);
    return NextResponse.json(
      { error: 'checkout-failed', message: 'Could not start checkout — please try again.' },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
}
