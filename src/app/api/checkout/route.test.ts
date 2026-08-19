import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => {
  const verifyIdToken = vi.fn();
  const createCheckoutTransaction = vi.fn();
  const isPaddleConfigured = vi.fn(() => true);
  const consumeDistributedRateLimit = vi.fn();
  return { verifyIdToken, createCheckoutTransaction, isPaddleConfigured, consumeDistributedRateLimit };
});

vi.mock('@/lib/firebase/admin', () => ({
  isAdminConfigured: () => true,
  verifyIdToken: h.verifyIdToken,
}));

vi.mock('@/lib/paddle/server', () => ({
  isPaddleConfigured: h.isPaddleConfigured,
  createCheckoutTransaction: h.createCheckoutTransaction,
}));

vi.mock('@/lib/distributedRateLimit', () => ({
  consumeDistributedRateLimit: h.consumeDistributedRateLimit,
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
  h.createCheckoutTransaction.mockReset();
  h.isPaddleConfigured.mockReset();
  h.isPaddleConfigured.mockReturnValue(true);
  h.createCheckoutTransaction.mockResolvedValue({
    transactionId: 'txn_test_123',
    checkoutUrl: 'https://checkout.paddle.com/checkout/txn_test_123',
  });
  h.consumeDistributedRateLimit.mockReset();
  h.consumeDistributedRateLimit.mockResolvedValue('allowed');
});

describe('POST /api/checkout — authentication', () => {
  it('rejects requests without an Authorization header', async () => {
    const res = await POST(checkoutRequest({ planId: 'pro', billing: 'annual' }));
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ error: 'unauthenticated' });
    expect(h.createCheckoutTransaction).not.toHaveBeenCalled();
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
    expect(h.createCheckoutTransaction).not.toHaveBeenCalled();
  });
});

describe('POST /api/checkout — identity', () => {
  it('uses the server-verified uid and ignores a spoofed client userId', async () => {
    h.verifyIdToken.mockResolvedValue('verified-uid-123');
    const res = await POST(
      checkoutRequest({ planId: 'pro', billing: 'annual', userId: 'spoofed-uid' }, 'real-id-token'),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      transactionId: 'txn_test_123',
      checkoutUrl: 'https://checkout.paddle.com/checkout/txn_test_123',
    });
    expect(h.verifyIdToken).toHaveBeenCalledWith('real-id-token');
    const args = h.createCheckoutTransaction.mock.calls[0][0];
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
    expect(h.createCheckoutTransaction.mock.calls[0][0].billing).toBe('monthly');
    const res2 = await POST(checkoutRequest({ planId: 'basic', billing: 'annual' }, 'tok'));
    expect(res2.status).toBe(400);
    expect(h.createCheckoutTransaction).toHaveBeenCalledTimes(1);
    const res3 = await POST(checkoutRequest({ planId: 'enterprise', billing: 'annual' }, 'tok'));
    expect(res3.status).toBe(400);
  });

  it('rejects an unparseable body', async () => {
    h.verifyIdToken.mockResolvedValue('uid-1');
    const res = await POST(
      new Request('https://audiorepeat.vercel.app/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer tok' },
        body: '{not json',
      }),
    );
    expect(res.status).toBe(400);
    expect(h.createCheckoutTransaction).not.toHaveBeenCalled();
  });

  it('rejects an invalid billing value', async () => {
    h.verifyIdToken.mockResolvedValue('uid-1');
    const res = await POST(checkoutRequest({ planId: 'pro', billing: 'weekly' }, 'tok'));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: 'invalid-billing' });
    expect(h.createCheckoutTransaction).not.toHaveBeenCalled();
  });
});

describe('POST /api/checkout — configuration', () => {
  it('returns 503 when Paddle is not configured', async () => {
    h.isPaddleConfigured.mockReturnValue(false);
    h.verifyIdToken.mockResolvedValue('uid-1');
    const res = await POST(checkoutRequest({ planId: 'pro', billing: 'annual' }, 'tok'));
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ error: 'paddle-not-configured' });
    expect(h.createCheckoutTransaction).not.toHaveBeenCalled();
  });
});

describe('POST /api/checkout — caching', () => {
  it('returns Cache-Control: no-store on success, auth and validation responses', async () => {
    h.verifyIdToken.mockResolvedValue('uid-1');

    const ok = await POST(checkoutRequest({ planId: 'pro', billing: 'annual' }, 'tok'));
    expect(ok.status).toBe(200);
    expect(ok.headers.get('Cache-Control')).toBe('no-store');

    const noAuth = await POST(checkoutRequest({ planId: 'pro', billing: 'annual' }));
    expect(noAuth.headers.get('Cache-Control')).toBe('no-store');

    const badPlan = await POST(checkoutRequest({ planId: 'basic', billing: 'annual' }, 'tok'));
    expect(badPlan.headers.get('Cache-Control')).toBe('no-store');

    const badBilling = await POST(checkoutRequest({ planId: 'pro', billing: 'weekly' }, 'tok'));
    expect(badBilling.headers.get('Cache-Control')).toBe('no-store');

    h.isPaddleConfigured.mockReturnValue(false);
    const unconfigured = await POST(checkoutRequest({ planId: 'pro', billing: 'annual' }, 'tok'));
    expect(unconfigured.headers.get('Cache-Control')).toBe('no-store');
  });
});

describe('POST /api/checkout — abuse protection', () => {
  it('rate-limits repeated transaction creation per verified uid', async () => {
    h.verifyIdToken.mockResolvedValue('rate-limit-user');
    let consumed = 0;
    h.consumeDistributedRateLimit.mockImplementation(async () =>
      ++consumed <= 10 ? 'allowed' : 'limited',
    );
    for (let i = 0; i < 10; i += 1) {
      expect((await POST(checkoutRequest({ planId: 'pro', billing: 'annual' }, 'tok'))).status).toBe(200);
    }
    const limited = await POST(checkoutRequest({ planId: 'pro', billing: 'annual' }, 'tok'));
    expect(limited.status).toBe(429);
    expect(limited.headers.get('Retry-After')).toBe('600');
    expect(h.createCheckoutTransaction).toHaveBeenCalledTimes(10);
  });
});
