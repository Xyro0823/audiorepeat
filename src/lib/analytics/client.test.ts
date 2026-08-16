import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => {
  const getAuthIdToken = vi.fn<() => Promise<string | null>>();
  return { getAuthIdToken };
});

vi.mock('@/lib/authStore', () => ({
  getAuthIdToken: h.getAuthIdToken,
}));

import {
  buildOnboardingEvent,
  fireOnboardingEvent,
  fireOnboardingEventOnce,
  markOnboardingEventFired,
  onboardingEventHasFired,
} from '@/lib/analytics/client';

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  h.getAuthIdToken.mockReset();
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('buildOnboardingEvent', () => {
  it('builds a valid payload', () => {
    expect(buildOnboardingEvent('onboarding_language_selected', { language: 'mn' })).toEqual({
      event: 'onboarding_language_selected',
      properties: { language: 'mn' },
    });
  });

  it('returns null for an invalid payload (never sent)', () => {
    expect(buildOnboardingEvent('onboarding_language_selected', { language: 'xx' })).toBeNull();
    // Missing required property (completionAction) — typed callers can't build
    // this, so the cast exercises the runtime guard.
    expect(
      buildOnboardingEvent('onboarding_completed', {
        language: 'mn',
        level: 'A1',
        goal: 'general',
      } as never),
    ).toBeNull();
  });
});

describe('fireOnboardingEvent — transport', () => {
  it('POSTs the validated payload with a Bearer token', async () => {
    h.getAuthIdToken.mockResolvedValue('token-123');
    fetchMock.mockResolvedValue(new Response('{"ok":true}', { status: 200 }));
    fireOnboardingEvent('onboarding_language_selected', { language: 'mn' });
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/analytics/onboarding');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer token-123');
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json');
    expect(JSON.parse(init.body as string)).toEqual({
      event: 'onboarding_language_selected',
      properties: { language: 'mn' },
    });
  });

  it('does nothing without a token (no fetch, no throw)', async () => {
    h.getAuthIdToken.mockResolvedValue(null);
    fireOnboardingEvent('onboarding_language_selected', { language: 'mn' });
    await new Promise((r) => setTimeout(r, 20));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('never throws when the fetch rejects (fire-and-forget)', async () => {
    h.getAuthIdToken.mockResolvedValue('token-123');
    fetchMock.mockRejectedValue(new Error('offline'));
    expect(() => fireOnboardingEvent('onboarding_language_selected', { language: 'mn' })).not.toThrow();
    await new Promise((r) => setTimeout(r, 20));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('never throws when token acquisition fails', async () => {
    h.getAuthIdToken.mockRejectedValue(new Error('auth broken'));
    expect(() => fireOnboardingEvent('onboarding_language_selected', { language: 'mn' })).not.toThrow();
    await new Promise((r) => setTimeout(r, 20));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not send an invalid payload even with a token', async () => {
    h.getAuthIdToken.mockResolvedValue('token-123');
    fireOnboardingEvent('onboarding_language_selected', { language: 'not-a-language' });
    await new Promise((r) => setTimeout(r, 20));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('ignores a failing response status (drop silently)', async () => {
    h.getAuthIdToken.mockResolvedValue('token-123');
    fetchMock.mockResolvedValue(new Response('{"error":"invalid-event"}', { status: 400 }));
    expect(() => fireOnboardingEvent('onboarding_language_selected', { language: 'mn' })).not.toThrow();
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  });

  it('treats a 429 rate-limit response like any other failure (never blocks)', async () => {
    h.getAuthIdToken.mockResolvedValue('token-123');
    fetchMock.mockResolvedValue(new Response('{"error":"rate-limited"}', { status: 429 }));
    expect(() => fireOnboardingEvent('onboarding_language_selected', { language: 'mn' })).not.toThrow();
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  });
});

describe('dedupe helpers', () => {
  it('fireOnboardingEventOnce fires once per key even when called repeatedly', async () => {
    h.getAuthIdToken.mockResolvedValue('token-123');
    fetchMock.mockResolvedValue(new Response('{"ok":true}', { status: 200 }));
    fireOnboardingEventOnce('once:a', 'onboarding_started', {});
    fireOnboardingEventOnce('once:a', 'onboarding_started', {});
    fireOnboardingEventOnce('once:a', 'onboarding_started', {});
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  });

  it('different keys fire independently', async () => {
    h.getAuthIdToken.mockResolvedValue('token-123');
    fetchMock.mockResolvedValue(new Response('{"ok":true}', { status: 200 }));
    fireOnboardingEventOnce('once:b', 'onboarding_started', {});
    fireOnboardingEventOnce('once:c', 'onboarding_started', {});
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });

  it('onboardingEventHasFired / markOnboardingEventFired bookkeeping works', () => {
    const key = 'bk:' + Math.random().toString(36).slice(2);
    expect(onboardingEventHasFired(key)).toBe(false);
    markOnboardingEventFired(key);
    expect(onboardingEventHasFired(key)).toBe(true);
  });
});
