import { describe, expect, it } from 'vitest';
import { createUpdateCoordinator, SKIP_WAITING_MESSAGE } from './updateFlow';

describe('createUpdateCoordinator', () => {
  it('never reloads without an accepted update', () => {
    const flow = createUpdateCoordinator();
    expect(flow.isAwaitingActivation()).toBe(false);
    expect(flow.shouldReloadOnControllerChange()).toBe(false);
  });

  it('reloads exactly once after the user accepts', () => {
    const flow = createUpdateCoordinator();
    flow.requestUpdate();
    expect(flow.isAwaitingActivation()).toBe(true);
    // New worker activates → controllerchange fires.
    expect(flow.shouldReloadOnControllerChange()).toBe(true);
    // Any further controllerchange events (or a duplicate event) are ignored.
    expect(flow.shouldReloadOnControllerChange()).toBe(false);
    expect(flow.shouldReloadOnControllerChange()).toBe(false);
    expect(flow.isAwaitingActivation()).toBe(false);
  });

  it('ignores controllerchange events from unrelated claims', () => {
    const flow = createUpdateCoordinator();
    // First-install clients.claim() fires controllerchange with no update pending.
    expect(flow.shouldReloadOnControllerChange()).toBe(false);
    // A later accepted update still reloads exactly once.
    flow.requestUpdate();
    expect(flow.shouldReloadOnControllerChange()).toBe(true);
    expect(flow.shouldReloadOnControllerChange()).toBe(false);
  });
});

describe('SKIP_WAITING_MESSAGE', () => {
  it('is the message sw.js listens for', () => {
    expect(SKIP_WAITING_MESSAGE).toEqual({ type: 'SKIP_WAITING' });
  });
});
