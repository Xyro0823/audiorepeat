import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  token: vi.fn(),
  getCached: vi.fn(),
  putCached: vi.fn(),
}));

vi.mock('@/lib/authStore', () => ({ getAuthIdToken: h.token }));
vi.mock('@/lib/audio/cache', () => ({
  audioCacheKey: (text: string, lang: string) => `${lang}|${text}`,
  getCachedAudioBlob: h.getCached,
  putCachedAudioBlob: h.putCached,
}));

import { fetchCloudAudioBlob, prewarmSetAudio } from './cloudTts';

function audioResponse(): Response {
  return new Response(new Uint8Array([1, 2, 3]), {
    status: 200,
    headers: { 'Content-Type': 'audio/mpeg' },
  });
}

beforeEach(() => {
  h.token.mockReset().mockResolvedValue('firebase-id-token');
  h.getCached.mockReset().mockResolvedValue(null);
  h.putCached.mockReset().mockResolvedValue(undefined);
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) =>
    String(input).endsWith('/api/tts') ? audioResponse() : audioResponse(),
  ));
});

describe('cloud TTS client', () => {
  it('authenticates same-origin synthesis and caches the returned audio', async () => {
    const blob = await fetchCloudAudioBlob('Сайн байна уу', 'mn-MN');
    expect(blob.type).toBe('audio/mpeg');
    const [, init] = vi.mocked(fetch).mock.calls[0];
    expect(init?.headers).toMatchObject({ Authorization: 'Bearer firebase-id-token' });
    expect(init?.body).toBe(JSON.stringify({ text: 'Сайн байна уу', lang: 'mn-MN' }));
    expect(h.putCached).toHaveBeenCalledWith('mn-MN|Сайн байна уу', expect.any(Blob));
  });

  it('uses cached audio without uploading text again', async () => {
    const cached = new Blob([new Uint8Array([9])], { type: 'audio/mpeg' });
    h.getCached.mockResolvedValue(cached);
    await expect(fetchCloudAudioBlob('private vocabulary', 'en-US')).resolves.toBe(cached);
    expect(fetch).not.toHaveBeenCalled();
    expect(h.token).not.toHaveBeenCalled();
  });

  it('prewarms target and translation with bounded concurrency', async () => {
    vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === '/api/tts' && init?.method !== 'POST') {
        return new Response(JSON.stringify({ configured: true }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return audioResponse();
    });
    const progress = vi.fn();
    prewarmSetAudio(
      [{ id: '1', target: 'bonjour', translation: 'hello' }],
      { lang: 'fr-FR', nativeLang: 'en-US', onProgress: progress },
    );
    await vi.waitFor(() => expect(progress).toHaveBeenLastCalledWith(2, 2, 2, 0));
    expect(h.putCached).toHaveBeenCalledTimes(2);
  });

  it('does not call the paid synthesis endpoint without an authenticated user', async () => {
    h.token.mockResolvedValue(null);
    const progress = vi.fn();
    prewarmSetAudio(
      [{ id: '1', target: 'bonjour', translation: 'hello' }],
      { lang: 'fr-FR', nativeLang: 'en-US', onProgress: progress },
    );
    await vi.waitFor(() => expect(progress).toHaveBeenLastCalledWith(2, 2, 0, 2));
    const postCalls = vi.mocked(fetch).mock.calls.filter(([, init]) => init?.method === 'POST');
    expect(postCalls).toHaveLength(0);
  });
});
