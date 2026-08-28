import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  verifyAdminRequest: vi.fn(),
  get: vi.fn(),
  update: vi.fn(),
}));

const chain = {
  orderBy: vi.fn(),
  limit: vi.fn(),
  get: h.get,
  doc: vi.fn(() => ({ update: h.update })),
};
chain.orderBy.mockReturnValue(chain);
chain.limit.mockReturnValue(chain);

vi.mock('@/lib/firebase/admin', () => ({
  verifyAdminRequest: h.verifyAdminRequest,
  getAdminDb: () => ({ collection: () => chain }),
}));

vi.mock('firebase-admin/firestore', () => ({
  Timestamp: { fromMillis: vi.fn((value: number) => value) },
}));

import { GET, PATCH } from '@/app/api/admin/translation-reports/route';

function request(method = 'GET', body?: unknown): Request {
  return new Request('https://audiorepeat.app/api/admin/translation-reports', {
    method,
    headers: { Authorization: 'Bearer admin-token', ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
}

function doc(id: string, data: Record<string, unknown>) {
  return { id, data: () => data };
}

beforeEach(() => {
  vi.clearAllMocks();
  chain.orderBy.mockReturnValue(chain);
  chain.limit.mockReturnValue(chain);
  chain.doc.mockReturnValue({ update: h.update });
});

describe('admin translation report queue', () => {
  it('requires an allowlisted admin to read the queue', async () => {
    h.verifyAdminRequest.mockResolvedValue({ ok: false, status: 403, error: 'forbidden' });
    const response = await GET(request());
    expect(response.status).toBe(403);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(h.get).not.toHaveBeenCalled();
  });

  it('returns only open, well-formed reports', async () => {
    h.verifyAdminRequest.mockResolvedValue({ ok: true, adminUid: 'admin' });
    h.get.mockResolvedValue({
      docs: [
        doc('validReport123', {
          status: 'open', language: 'en-us', target: 'good morning', currentTranslation: 'өглөөний мэнд', suggestion: 'Өглөөний мэнд',
          createdAt: { toMillis: () => Date.UTC(2026, 7, 28) }, privateUid: 'must-not-leak',
        }),
        doc('closedReport12', {
          status: 'approved', language: 'en', target: 'hello', currentTranslation: 'сайн уу', suggestion: 'Сайн уу',
          createdAt: { toMillis: () => Date.UTC(2026, 7, 28) },
        }),
      ],
    });
    const response = await GET(request());
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).not.toContain('must-not-leak');
    expect(JSON.parse(text)).toEqual({
      reports: [{
        id: 'validReport123', language: 'en-us', target: 'good morning', currentTranslation: 'өглөөний мэнд', suggestion: 'Өглөөний мэнд',
        createdAt: '2026-08-28T00:00:00.000Z',
      }],
    });
  });

  it('records an approved review without returning private report fields', async () => {
    h.verifyAdminRequest.mockResolvedValue({ ok: true, adminUid: 'admin' });
    h.update.mockResolvedValue(undefined);
    const response = await PATCH(request('PATCH', { id: 'validReport123', status: 'approved' }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(h.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'approved', reviewedAt: expect.any(Number) }));
  });

  it('rejects invalid review requests before writing', async () => {
    h.verifyAdminRequest.mockResolvedValue({ ok: true, adminUid: 'admin' });
    const response = await PATCH(request('PATCH', { id: 'short', status: 'open' }));
    expect(response.status).toBe(400);
    expect(h.update).not.toHaveBeenCalled();
  });
});
