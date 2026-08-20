import { beforeEach, describe, expect, it, vi } from 'vitest';
import { captureInstallEvent, clearInstallEvent, getInstallSnapshot, requestInstall, subscribeInstall } from './installStore';

describe('install prompt store', () => {
  beforeEach(() => clearInstallEvent());

  it('publishes a captured browser install event', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeInstall(listener);
    const event = { prompt: vi.fn(async () => undefined), userChoice: Promise.resolve({ outcome: 'accepted' as const }) };
    captureInstallEvent(event);
    expect(getInstallSnapshot()).toBe(event);
    expect(listener).toHaveBeenCalledOnce();
    unsubscribe();
  });

  it('prompts once and consumes the event', async () => {
    const event = { prompt: vi.fn(async () => undefined), userChoice: Promise.resolve({ outcome: 'accepted' as const }) };
    captureInstallEvent(event);
    await requestInstall();
    expect(event.prompt).toHaveBeenCalledOnce();
    expect(getInstallSnapshot()).toBeNull();
  });

  it('is a safe no-op when install is unavailable', async () => {
    await expect(requestInstall()).resolves.toBeUndefined();
  });
});
