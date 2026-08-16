import { beforeEach, describe, expect, it, vi } from 'vitest';

type FakeDoc = { data: () => unknown };

const h = vi.hoisted(() => {
  const verifyAdminRequest = vi.fn<() => Promise<{ ok: true; adminUid: string } | { ok: false; status: number; error: string }>>();
  const docs = vi.fn<() => FakeDoc[]>();
  const limit = vi.fn(() => ({ get: async () => ({ docs: h.docs() }) }));
  const orderBy = vi.fn(() => ({ limit }));
  const where = vi.fn(() => ({ orderBy }));
  const collection = vi.fn(() => ({ where }));
  const getAdminDb = vi.fn(() => ({ collection }));
  return { verifyAdminRequest, getAdminDb, collection, where, orderBy, limit, docs };
});

vi.mock('@/lib/firebase/admin', () => ({
  verifyAdminRequest: h.verifyAdminRequest,
  getAdminDb: h.getAdminDb,
}));

import { GET } from '@/app/api/admin/analytics/onboarding/route';

function getRequest(query = ''): Request {
  return new Request(`https://audiorepeat.vercel.app/api/admin/analytics/onboarding${query}`, {
    headers: { Authorization: 'Bearer admin-token' },
  });
}

const doc = (data: unknown): FakeDoc => ({ data: () => data });

function allowAdmin(uid = 'admin-1') {
  h.verifyAdminRequest.mockResolvedValue({ ok: true, adminUid: uid });
}

beforeEach(() => {
  h.verifyAdminRequest.mockReset();
  h.collection.mockClear();
  h.where.mockClear();
  h.orderBy.mockClear();
  h.limit.mockClear();
  h.docs.mockReset().mockReturnValue([]);
  allowAdmin();
});

describe('GET /api/admin/analytics/onboarding — authorization', () => {
  it('rejects unauthenticated requests', async () => {
    h.verifyAdminRequest.mockResolvedValue({ ok: false, status: 401, error: 'unauthenticated' });
    const res = await GET(getRequest());
    expect(res.status).toBe(401);
    expect(h.collection).not.toHaveBeenCalled();
  });

  it('rejects a valid token that is NOT on the admin allowlist', async () => {
    h.verifyAdminRequest.mockResolvedValue({ ok: false, status: 403, error: 'forbidden' });
    const res = await GET(getRequest());
    expect(res.status).toBe(403);
    expect(h.collection).not.toHaveBeenCalled();
  });
});

describe('GET /api/admin/analytics/onboarding — aggregation', () => {
  it('queries the analytics collection with a bounded window and limit', async () => {
    await GET(getRequest('?days=30&limit=100'));
    expect(h.collection).toHaveBeenCalledWith('analytics_events');
    expect(h.where).toHaveBeenCalledWith('ts', '>=', expect.anything());
    expect(h.orderBy).toHaveBeenCalledWith('ts', 'desc');
    expect(h.limit).toHaveBeenCalledWith(100);
  });

  it('clamps out-of-range window/limit params to safe bounds', async () => {
    await GET(getRequest('?days=9999&limit=999999'));
    expect(h.where).toHaveBeenCalledWith('ts', '>=', expect.anything());
    expect(h.limit).toHaveBeenCalledWith(10000);
  });

  it('returns an empty summary when there are no events', async () => {
    const res = await GET(getRequest());
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; summary: { started: number; completed: number } };
    expect(body.ok).toBe(true);
    expect(body.summary.started).toBe(0);
    expect(body.summary.completed).toBe(0);
  });

  it('aggregates stored events into the summary', async () => {
    h.docs.mockReturnValue([
      doc({ event: 'onboarding_started', properties: {}, ts: {} }),
      doc({ event: 'onboarding_started', properties: {}, ts: {} }),
      doc({ event: 'onboarding_language_selected', properties: { language: 'mn' }, ts: {} }),
      doc({
        event: 'onboarding_completed',
        properties: { language: 'mn', level: 'A1', goal: 'general', completionAction: 'practice' },
        ts: {},
      }),
      doc({ event: 'garbage', properties: { x: 1 }, ts: {} }), // skipped defensively
    ]);
    const res = await GET(getRequest());
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      windowDays: number;
      summary: {
        started: number;
        completed: number;
        completionPct: number;
        topLanguages: Array<{ value: string; count: number }>;
      };
    };
    expect(body.windowDays).toBe(90);
    expect(body.summary.started).toBe(2);
    expect(body.summary.completed).toBe(1);
    expect(body.summary.completionPct).toBe(50);
    expect(body.summary.topLanguages).toEqual([{ value: 'mn', count: 1 }]);
  });

  it('never exposes a uid in the response', async () => {
    h.docs.mockReturnValue([
      doc({ event: 'onboarding_started', properties: {}, ts: {} }),
      doc({ event: 'onboarding_started', properties: {}, ts: {} }),
    ]);
    const res = await GET(getRequest());
    const text = await res.text();
    expect(text).not.toMatch(/uid|email|admin-1/i);
  });

  it('returns 500 when the query fails', async () => {
    h.limit.mockReturnValueOnce({ get: async () => Promise.reject(new Error('firestore down')) });
    const res = await GET(getRequest());
    expect(res.status).toBe(500);
  });
});
