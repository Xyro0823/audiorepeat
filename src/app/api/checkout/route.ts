import { NextResponse } from 'next/server';
import { createCheckoutSession, isStripeConfigured, type Billing } from '@/lib/stripe/server';
import { isPlanId } from '@/lib/plans';

export const runtime = 'nodejs';

/**
 * Create a Stripe Checkout Session for the selected paid plan.
 *
 * The client posts { planId, billing } and receives the hosted Checkout URL
 * to redirect to — the secret key never leaves the server. When Stripe isn't
 * configured (no STRIPE_SECRET_KEY / price ids), this returns 503 and the UI
 * keeps the honest placeholder + free-access fallback.
 */
export async function POST(request: Request) {
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: 'stripe-not-configured' }, { status: 503 });
  }

  let body: { planId?: string; billing?: string; userId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid-body' }, { status: 400 });
  }

  const { planId, userId } = body;
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
      userId: typeof userId === 'string' ? userId : undefined,
    });
    return NextResponse.json({ url });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'checkout-failed';
    if (message === 'price-not-configured') {
      return NextResponse.json(
        { error: 'price-not-configured', message: 'This plan has no Stripe price configured yet.' },
        { status: 400 },
      );
    }
    console.error('[checkout] create session failed:', message);
    return NextResponse.json(
      { error: 'checkout-failed', message: 'Could not start checkout — please try again.' },
      { status: 500 },
    );
  }
}
