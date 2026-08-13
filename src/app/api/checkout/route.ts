import { NextResponse } from 'next/server';
import { createCheckoutSession, isStripeConfigured, type Billing } from '@/lib/stripe/server';
import { isAdminConfigured, verifyIdToken } from '@/lib/firebase/admin';
import { isPlanId } from '@/lib/plans';

export const runtime = 'nodejs';

/** Extract a Bearer token from the Authorization header, if present. */
function bearerToken(request: Request): string | null {
  const auth = request.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  const token = auth.slice('Bearer '.length).trim();
  return token.length > 0 ? token : null;
}

/**
 * Create a Stripe Checkout Session for the selected paid plan.
 *
 * The caller MUST be an authenticated Firebase user: the client sends their
 * ID token as `Authorization: Bearer <idToken>`, it is verified server-side
 * with firebase-admin, and the verified uid is used for the Stripe Customer +
 * session metadata. A client-supplied `userId` in the body is never trusted.
 *
 * When Stripe or the admin layer isn't configured, this returns 503 and the
 * UI keeps the honest placeholder + free-access fallback.
 */
export async function POST(request: Request) {
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: 'stripe-not-configured' }, { status: 503 });
  }
  if (!isAdminConfigured()) {
    return NextResponse.json(
      { error: 'auth-server-not-configured', message: 'Server-side auth is not configured yet.' },
      { status: 503 },
    );
  }

  const token = bearerToken(request);
  if (!token) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }
  // The uid is derived from the verified token — the body never contributes
  // identity (a spoofed `userId` payload is ignored by simply not reading it).
  const uid = await verifyIdToken(token);
  if (!uid) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  let body: { planId?: string; billing?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid-body' }, { status: 400 });
  }

  const { planId } = body;
  const billing: Billing = body.billing === 'monthly' ? 'monthly' : 'annual';

  if (!isPlanId(planId) || planId === 'basic') {
    return NextResponse.json({ error: 'invalid-plan' }, { status: 400 });
  }

  const origin = new URL(request.url).origin;
  if (!origin) {
    return NextResponse.json({ error: 'missing-origin' }, { status: 400 });
  }

  try {
    const { url } = await createCheckoutSession({
      planId,
      billing,
      origin,
      uid,
    });
    return NextResponse.json({ url });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'checkout-failed';
    if (message === 'price-not-configured') {
      return NextResponse.json(
        { error: 'price-not-configured', message: 'This plan has no Stripe price configured yet.' },
        { status: 400 },
      );
    }
    if (message === 'firebase-admin-not-configured') {
      return NextResponse.json(
        { error: 'auth-server-not-configured', message: 'Server-side auth is not configured yet.' },
        { status: 503 },
      );
    }
    console.error('[checkout] create session failed:', message);
    return NextResponse.json(
      { error: 'checkout-failed', message: 'Could not start checkout — please try again.' },
      { status: 500 },
    );
  }
}
