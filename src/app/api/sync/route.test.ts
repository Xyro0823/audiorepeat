import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  configured: true,
  verify: vi.fn(),
  rate: vi.fn(),
  getDb: vi.fn(),
}));

vi.mock('@/lib/firebase/admin', () => ({
  isAdminConfigured: () => h.configured,
  verifyIdToken: h.verify,
  getAdminDb: h.getDb,
}));
vi.mock('@/lib/distributedRateLimit', () => ({ consumeDistributedRateLimit: h.rate }));

import { POST } from './route';

function request(body: unknown, token?: string, contentLength?: string): Request {
  return new Request('https://app.example/api/sync', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(contentLength ? { 'Content-Length': contentLength } : {}),
    },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  h.configured = true;
  h.verify.mockReset().mockResolvedValue('uid-1');
  h.rate.mockReset().mockResolvedValue('allowed');
  h.getDb.mockReset();
});

describe('POST /api/sync security boundary', () => {
  it('fails closed when server auth is unavailable', async () => {
    h.configured = false;
    expect((await POST(request({ sets: [], tombstones: [] }, 'token'))).status).toBe(503);
  });

  it('requires a verified Firebase identity and ignores body identity', async () => {
    expect((await POST(request({ sets: [], tombstones: [], uid: 'admin' }))).status).toBe(401);
    h.verify.mockResolvedValue(null);
    expect((await POST(request({ sets: [], tombstones: [], uid: 'admin' }, 'bad'))).status).toBe(401);
    expect(h.getDb).not.toHaveBeenCalled();
  });

  it('rejects oversized and malformed payloads before Firestore access', async () => {
    expect((await POST(request({ sets: [], tombstones: [] }, 'token', '6000000'))).status).toBe(413);
    expect((await POST(request({ sets: 'bad', tombstones: [] }, 'token'))).status).toBe(400);
    expect(h.getDb).not.toHaveBeenCalled();
  });

  it('rate-limits by verified uid', async () => {
    h.rate.mockResolvedValue('limited');
    const response = await POST(request({ sets: [], tombstones: [] }, 'token'));
    expect(response.status).toBe(429);
    expect(h.rate).toHaveBeenCalledWith(expect.objectContaining({ key: 'library-sync:uid-1' }));
    expect(h.getDb).not.toHaveBeenCalled();
  });
});
