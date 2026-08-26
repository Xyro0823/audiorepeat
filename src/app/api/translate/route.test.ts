import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const h = vi.hoisted(() => ({
  configured: true,
  adminConfigured: true,
  verifyIdToken: vi.fn(),
  consume: vi.fn(),
  translate: vi.fn(),
}));

vi.mock('@/lib/firebase/admin', () => ({
  isAdminConfigured: () => h.adminConfigured,
  verifyIdToken: h.verifyIdToken,
}));
vi.mock('@/lib/distributedRateLimit', () => ({ consumeDistributedRateLimit: h.consume }));
vi.mock('@/lib/translator/azureTranslator.server', () => ({
  isAzureTranslatorConfigured: () => h.configured,
  MAX_TRANSLATE_ITEMS: 25,
  MAX_TRANSLATE_CHARS: 5_000,
  translateToMongolian: h.translate,
}));

import { GET, POST } from './route';

function request(items: unknown, token?: string): Request {
  return new Request('https://app.example/api/translate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ items }),
  });
}

beforeEach(() => {
  h.configured = true;
  h.adminConfigured = true;
  h.verifyIdToken.mockReset().mockResolvedValue('uid-1');
  h.consume.mockReset().mockResolvedValue('allowed');
  h.translate.mockReset().mockResolvedValue(['сайн байна уу']);
});

describe('/api/translate', () => {
  it('reports readiness without exposing credentials', async () => {
    expect(await (await GET()).json()).toEqual({ configured: true, provider: 'azure' });
  });

  it('requires a server-verified Firebase identity', async () => {
    expect((await POST(request([{ id: '1', text: 'hello' }]))).status).toBe(401);
    h.verifyIdToken.mockResolvedValue(null);
    expect((await POST(request([{ id: '1', text: 'hello' }], 'bad'))).status).toBe(401);
  });

  it('rejects oversize batches before calling Azure', async () => {
    const tooMany = Array.from({ length: 26 }, (_, id) => ({ id: String(id), text: 'hello' }));
    expect((await POST(request(tooMany, 'token'))).status).toBe(400);
    expect((await POST(request([{ id: '1', text: 'x'.repeat(501) }], 'token'))).status).toBe(400);
    expect(h.translate).not.toHaveBeenCalled();
  });

  it('translates a validated batch through the server-only adapter', async () => {
    const response = await POST(request([{ id: 'word-1', text: 'hello' }], 'token'));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ translations: ['сайн байна уу'] });
    expect(h.translate).toHaveBeenCalledWith(['hello']);
    expect(h.consume).toHaveBeenCalledWith(expect.objectContaining({ key: 'translate-burst:uid-1' }));
  });

  it('stops before Azure when rate limited', async () => {
    h.consume.mockResolvedValue('limited');
    expect((await POST(request([{ id: 'word-1', text: 'hello' }], 'token'))).status).toBe(429);
    expect(h.translate).not.toHaveBeenCalled();
  });
});
