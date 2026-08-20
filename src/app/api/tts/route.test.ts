import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  configured: true,
  adminConfigured: true,
  verifyIdToken: vi.fn(),
  consume: vi.fn(),
  synthesize: vi.fn(),
}));

vi.mock('@/lib/firebase/admin', () => ({
  isAdminConfigured: () => h.adminConfigured,
  verifyIdToken: h.verifyIdToken,
}));
vi.mock('@/lib/distributedRateLimit', () => ({ consumeDistributedRateLimit: h.consume }));
vi.mock('@/lib/tts/azureTts.server', () => ({
  isAzureTtsConfigured: () => h.configured,
  synthesizeAzureSpeech: h.synthesize,
}));

import { GET, POST } from './route';

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

  it('rate-limits by verified uid before using the paid provider', async () => {
    h.consume.mockResolvedValue('limited');
    const response = await POST(request({ text: 'hello', lang: 'en-US' }, 'token'));
    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBe('600');
    expect(h.consume).toHaveBeenCalledWith(expect.objectContaining({ key: 'tts:uid-1' }));
    expect(h.synthesize).not.toHaveBeenCalled();
  });

  it('fails closed when Azure or server authentication is unconfigured', async () => {
    h.configured = false;
    expect((await POST(request({ text: 'hello', lang: 'en-US' }, 'token'))).status).toBe(503);
    h.configured = true;
    h.adminConfigured = false;
    expect((await POST(request({ text: 'hello', lang: 'en-US' }, 'token'))).status).toBe(503);
  });
});
