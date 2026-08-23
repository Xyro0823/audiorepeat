import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const h = vi.hoisted(() => ({
  configured: true,
  adminConfigured: true,
  verifyIdToken: vi.fn(),
  consume: vi.fn(),
  synthesize: vi.fn(),
  entitlement: null as unknown,
}));

vi.mock('@/lib/firebase/admin', () => ({
  isAdminConfigured: () => h.adminConfigured,
  verifyIdToken: h.verifyIdToken,
  createEntitlementStore: () => ({ getEntitlement: async () => h.entitlement }),
}));
vi.mock('@/lib/distributedRateLimit', () => ({ consumeDistributedRateLimit: h.consume }));
vi.mock('@/lib/tts/azureTts.server', () => ({
  isAzureTtsConfigured: () => h.configured,
  synthesizeAzureSpeech: h.synthesize,
}));

import { GET, POST } from './route';
import { resetTtsReplayCacheForTests } from '@/lib/tts/ttsReplayCache.server';

function request(body: unknown, token?: string, headers?: Record<string, string>): Request {
  return new Request('https://app.example/api/tts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  h.configured = true;
  h.adminConfigured = true;
  resetTtsReplayCacheForTests();
  // Route-level tests exercise input validation / rate limits with an
  // entitled (active Pro) user; the entitlement gate itself has its own
  // dedicated coverage in route.gate.test.ts.
  h.entitlement = {
    uid: 'uid-1',
    plan: 'pro',
    billing: 'monthly',
    status: 'active',
    currentPeriodEnd: null,
  };
  h.verifyIdToken.mockReset().mockResolvedValue('uid-1');
  h.consume.mockReset().mockResolvedValue('allowed');
  h.synthesize.mockReset().mockResolvedValue({
    audio: new Uint8Array([1, 2, 3]).buffer,
    voice: 'mn-MN-YesuiNeural',
  });
});

describe('/api/tts', () => {
  it('reports provider readiness without exposing credentials', async () => {
    const response = await GET();
    expect(await response.json()).toEqual({ configured: true, provider: 'azure' });
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });

  it('requires a server-verified Firebase identity', async () => {
    expect((await POST(request({ text: 'hello', lang: 'en-US' }))).status).toBe(401);
    h.verifyIdToken.mockResolvedValue(null);
    expect((await POST(request({ text: 'hello', lang: 'en-US' }, 'bad'))).status).toBe(401);
    expect(h.synthesize).not.toHaveBeenCalled();
  });

  it('rejects oversized or malformed text and language input', async () => {
    expect((await POST(request({ text: 'x'.repeat(301), lang: 'en-US' }, 'token'))).status).toBe(400);
    expect((await POST(request({ text: 'hello', lang: 'https://evil.test' }, 'token'))).status).toBe(400);
    expect((await POST(request({ text: 'hello', lang: 'en-US' }, 'token', { 'Content-Length': '5000' }))).status).toBe(413);
    expect(h.synthesize).not.toHaveBeenCalled();
  });

  it('returns private non-cacheable audio for valid input', async () => {
    const response = await POST(request({ text: 'Сайн байна уу', lang: 'mn-MN' }, 'token'));
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('audio/mpeg');
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(response.headers.get('X-AudioRepeat-Voice')).toBe('mn-MN-YesuiNeural');
    expect(h.synthesize).toHaveBeenCalledWith('Сайн байна уу', 'mn-MN');
  });

  it('rate-limits bursts by verified uid before using the paid provider', async () => {
    h.consume.mockResolvedValue('limited');
    const response = await POST(request({ text: 'hello', lang: 'en-US' }, 'token'));
    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBe('60');
    expect(h.consume).toHaveBeenCalledTimes(1);
    expect(h.consume).toHaveBeenCalledWith(expect.objectContaining({ key: 'tts-burst:uid-1' }));
    expect(h.synthesize).not.toHaveBeenCalled();
  });

  it('enforces a per-user daily synthesis ceiling', async () => {
    h.consume.mockImplementation(async (args: { key: string }) =>
      args.key.startsWith('tts-day:') ? 'limited' : 'allowed',
    );
    const response = await POST(request({ text: 'hello', lang: 'en-US' }, 'token'));
    expect(response.status).toBe(429);
    expect(await response.json()).toMatchObject({ error: 'rate-limited', scope: 'daily' });
    expect(response.headers.get('Retry-After')).toBe('86400');
    expect(h.consume).toHaveBeenCalledWith(expect.objectContaining({ key: 'tts-day:uid-1' }));
    expect(h.synthesize).not.toHaveBeenCalled();
  });

  it('serves identical replayed requests from cache without re-paying Azure', async () => {
    const first = await POST(request({ text: 'hola', lang: 'es-ES' }, 'token'));
    expect(first.status).toBe(200);
    const second = await POST(request({ text: 'hola', lang: 'es-ES' }, 'token'));
    expect(second.status).toBe(200);
    expect(second.headers.get('Content-Type')).toBe('audio/mpeg');
    expect(second.headers.get('X-AudioRepeat-Voice')).toBe('mn-MN-YesuiNeural');
    expect(h.synthesize).toHaveBeenCalledTimes(1);
    // Cache hits bypass the limiters entirely — replays must not burn quota.
    h.consume.mockClear();
    const third = await POST(request({ text: 'hola', lang: 'es-ES' }, 'token'));
    expect(third.status).toBe(200);
    expect(h.consume).not.toHaveBeenCalled();
    // A different text is a different key and synthesizes again.
    await POST(request({ text: 'adiós', lang: 'es-ES' }, 'token'));
    expect(h.synthesize).toHaveBeenCalledTimes(2);
  });

  it('fails closed when Azure or server authentication is unconfigured', async () => {
    h.configured = false;
    expect((await POST(request({ text: 'hello', lang: 'en-US' }, 'token'))).status).toBe(503);
    h.configured = true;
    h.adminConfigured = false;
    expect((await POST(request({ text: 'hello', lang: 'en-US' }, 'token'))).status).toBe(503);
  });
});
