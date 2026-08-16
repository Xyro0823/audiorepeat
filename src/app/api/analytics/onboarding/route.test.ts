import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => {
  const isAdminConfigured = vi.fn<() => boolean>();
  const verifyIdToken = vi.fn<(t: string) => Promise<string | null>>();
  const consume = vi.fn<() => 'allowed' | 'limited'>(() => 'allowed');
  const added: unknown[] = [];
  const add = vi.fn(async (doc: unknown) => {
    added.push(doc);
    return { id: 'auto-id' };
  });
  const collection = vi.fn(() => ({ add }));
  const getAdminDb = vi.fn(() => ({ collection }));
  return { isAdminConfigured, verifyIdToken, consume, getAdminDb, collection, add, added };
});

vi.mock('@/lib/firebase/admin', () => ({
  isAdminConfigured: h.isAdminConfigured,
  verifyIdToken: h.verifyIdToken,
  getAdminDb: h.getAdminDb,
}));

vi.mock('@/lib/analytics/rateLimit', () => ({
  analyticsRateLimiter: { consume: h.consume },
}));

import { POST } from '@/app/api/analytics/onboarding/route';

function post(body: unknown, token: string | null = 'valid-token'): Promise<Response> {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (token !== null) headers.set('Authorization', `Bearer ${token}`);
  return POST(
    new Request('https://audiorepeat.vercel.app/api/analytics/onboarding', {
      method: 'POST',
      headers,
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
  );
}

beforeEach(() => {
  h.isAdminConfigured.mockReset().mockReturnValue(true);
  h.verifyIdToken.mockReset().mockResolvedValue('uid-123');
  h.consume.mockReset().mockReturnValue('allowed');
  h.collection.mockClear();
  h.add.mockClear();
  h.added.length = 0;
});

describe('POST /api/analytics/onboarding — authorization', () => {
  it('returns 503 when the admin layer is not configured', async () => {
    h.isAdminConfigured.mockReturnValue(false);
    const res = await post({ event: 'onboarding_started', properties: {} });
    expect(res.status).toBe(503);
    expect(h.collection).not.toHaveBeenCalled();
  });

  it('returns 401 without a token', async () => {
    const res = await post({ event: 'onboarding_started', properties: {} }, null);
    expect(res.status).toBe(401);
    expect(h.verifyIdToken).not.toHaveBeenCalled();
  });

  it('returns 401 for an invalid token', async () => {
    h.verifyIdToken.mockResolvedValue(null);
    const res = await post({ event: 'onboarding_started', properties: {} }, 'bad-token');
    expect(res.status).toBe(401);
    expect(h.collection).not.toHaveBeenCalled();
  });
});

describe('POST /api/analytics/onboarding — validation (nothing invalid is stored)', () => {
  it('rejects unparseable JSON', async () => {
    const res = await post('{not json', 'valid-token');
    expect(res.status).toBe(400);
    expect(h.added).toEqual([]);
  });

  it('rejects an unknown event name', async () => {
    const res = await post({ event: 'clicked_button', properties: {} });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'invalid-event' });
    expect(h.added).toEqual([]);
  });

  it('rejects invalid property values', async () => {
    const res = await post({
      event: 'onboarding_language_selected',
      properties: { language: 'not-a-language' },
    });
    expect(res.status).toBe(400);
    expect(h.added).toEqual([]);
  });

  it('rejects missing required properties', async () => {
    const res = await post({
      event: 'onboarding_completed',
      properties: { language: 'mn', level: 'A1', goal: 'general' },
    });
    expect(res.status).toBe(400);
    expect(h.added).toEqual([]);
  });

  it('rejects PII fields (email key)', async () => {
    const res = await post({
      event: 'onboarding_language_selected',
      properties: { language: 'mn', email: 'someone@example.com' },
    });
    expect(res.status).toBe(400);
    expect(h.added).toEqual([]);
  });

  it('rejects a uid-shaped key', async () => {
    const res = await post({
      event: 'onboarding_started',
      properties: { uid: 'abc123' },
    });
    expect(res.status).toBe(400);
    expect(h.added).toEqual([]);
  });

  it('rejects an invalid completionAction', async () => {
    const res = await post({
      event: 'onboarding_completed',
      properties: { language: 'mn', level: 'A1', goal: 'general', completionAction: 'skip' },
    });
    expect(res.status).toBe(400);
    expect(h.added).toEqual([]);
  });

  it('rejects an invalid recommendationType', async () => {
    const res = await post({
      event: 'onboarding_ready_viewed',
      properties: {
        language: 'mn',
        level: 'A1',
        goal: 'general',
        recommendationType: 'ai',
        recommendationId: 'bank-full-mn-A1',
      },
    });
    expect(res.status).toBe(400);
    expect(h.added).toEqual([]);
  });
});

describe('POST /api/analytics/onboarding — rate limiting', () => {
  it('keys the limiter by the VERIFIED uid (never a client-supplied value)', async () => {
    h.verifyIdToken.mockResolvedValue('verified-uid-9');
    const res = await post({ event: 'onboarding_started', properties: {} });
    expect(res.status).toBe(200);
    expect(h.consume).toHaveBeenCalledWith('verified-uid-9');
  });

  it('rejects over-limit requests with 429 and stores nothing', async () => {
    h.consume.mockReturnValue('limited');
    const res = await post({ event: 'onboarding_started', properties: {} });
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ error: 'rate-limited' });
    expect(h.added).toEqual([]);
    expect(h.collection).not.toHaveBeenCalled();
  });

  it('only validated events consume the rate-limit quota', async () => {
    const res = await post({ event: 'onboarding_started', properties: { bogus: 'x' } });
    expect(res.status).toBe(400);
    expect(h.consume).not.toHaveBeenCalled();
  });

  it('a client cannot spoof a uid through the payload (schema rejects it)', async () => {
    const res = await post({
      event: 'onboarding_started',
      properties: { uid: 'attacker-chosen-uid' },
    });
    expect(res.status).toBe(400);
    expect(h.consume).not.toHaveBeenCalled();
    expect(h.added).toEqual([]);
  });

  it('429 responses carry no-store headers', async () => {
    h.consume.mockReturnValue('limited');
    const res = await post({ event: 'onboarding_started', properties: {} });
    expect(res.headers.get('Cache-Control')).toContain('no-store');
  });
});

describe('POST /api/analytics/onboarding — storage', () => {
  it('stores a validated event append-only, WITHOUT the uid', async () => {
    const res = await post({
      event: 'onboarding_goal_selected',
      properties: { language: 'mn', level: 'B1', goal: 'work' },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(h.collection).toHaveBeenCalledWith('analytics_events');
    expect(h.added).toHaveLength(1);
    const stored = h.added[0] as Record<string, unknown>;
    expect(stored.event).toBe('onboarding_goal_selected');
    expect(stored.properties).toEqual({ language: 'mn', level: 'B1', goal: 'work' });
    // The verified uid must never be part of the stored event.
    expect(JSON.stringify(stored)).not.toContain('uid-123');
    expect(stored.uid).toBeUndefined();
    expect(stored).toHaveProperty('ts');
  });

  it('stores onboarding_started with empty properties', async () => {
    const res = await post({ event: 'onboarding_started', properties: {} });
    expect(res.status).toBe(200);
    expect(h.added[0]).toMatchObject({ event: 'onboarding_started', properties: {} });
  });

  it('returns 500 when the store fails (client treats it as a dropped event)', async () => {
    h.add.mockRejectedValueOnce(new Error('firestore down'));
    const res = await post({ event: 'onboarding_started', properties: {} });
    expect(res.status).toBe(500);
  });
});
