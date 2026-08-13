import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => {
  const verifyIdToken = vi.fn();
  const createCheckoutSession = vi.fn();
  return { verifyIdToken, createCheckoutSession };
});

vi.mock('@/lib/firebase/admin', () => ({
  isAdminConfigured: () => true,
  verifyIdToken: h.verifyIdToken,
}));

vi.mock('@/lib/stripe/server', () => ({
  isStripeConfigured: () => true,
  createCheckoutSession: h.createCheckoutSession,
}));

import { POST } from '@/app/api/checkout/route';

function checkoutRequest(body: unknown, token?: string): Request {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (token !== undefined) headers.set('Authorization', `Bearer ${token}`);
  return new Request('https://audiorepeat.vercel.app/api/checkout', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  h.verifyIdToken.mockReset();
  h.createCheckoutSession.mockReset();
  h.createCheckoutSession.mockResolvedValue({ url: 'https://checkout.stripe.com/c/pay/cs_test' });
});

describe('POST /api/checkout — authentication', () => {
  it('rejects requests without an Authorization header', async () => {
    const res = await POST(checkoutRequest({ planId: 'pro', billing: 'annual' }));
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ error: 'unauthenticated' });
    expect(h.createCheckoutSession).not.toHaveBeenCalled();
  });

  it('rejects requests with a non-Bearer header', async () => {
    const headers = new Headers({ 'Content-Type': 'application/json' });
    headers.set('Authorization', 'Token abc');
    const res = await POST(
      new Request('https://audiorepeat.vercel.app/api/checkout', {
        method: 'POST',
        headers,
        body: JSON.stringify({ planId: 'pro', billing: 'annual' }),
      }),
    );
    expect(res.status).toBe(401);
  });

  it('rejects invalid/expired tokens', async () => {
    h.verifyIdToken.mockResolvedValue(null);
    const res = await POST(checkoutRequest({ planId: 'pro', billing: 'annual' }, 'bad-token'));
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ error: 'unauthenticated' });
    expect(h.createCheckoutSession).not.toHaveBeenCalled();
  });
});

describe('POST /api/checkout — identity', () => {
  it('uses the server-verified uid and ignores a spoofed client userId', async () => {
    h.verifyIdToken.mockResolvedValue('verified-uid-123');
    const res = await POST(
      checkoutRequest({ planId: 'pro', billing: 'annual', userId: 'spoofed-uid' }, 'real-id-token'),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ url: 'https://checkout.stripe.com/c/pay/cs_test' });
    expect(h.verifyIdToken).toHaveBeenCalledWith('real-id-token');
    const args = h.createCheckoutSession.mock.calls[0][0];
    expect(args.uid).toBe('verified-uid-123');
    expect(args.planId).toBe('pro');
    expect(args.billing).toBe('annual');
    // The spoofed body userId must never influence identity.
    expect(args.uid).not.toBe('spoofed-uid');
    expect(args).not.toHaveProperty('userId');
  });

  it('maps monthly billing and validates plan', async () => {
    h.verifyIdToken.mockResolvedValue('uid-1');
    const res = await POST(checkoutRequest({ planId: 'lifetime', billing: 'monthly' }, 'tok'));
    expect(res.status).toBe(200);
    expect(h.createCheckoutSession.mock.calls[0][0].billing).toBe('monthly');
    const res2 = await POST(checkoutRequest({ planId: 'basic', billing: 'annual' }, 'tok'));
    expect(res2.status).toBe(400);
    expect(h.createCheckoutSession).toHaveBeenCalledTimes(1);
  });
});
