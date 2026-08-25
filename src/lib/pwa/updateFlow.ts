/**
 * Service-worker update flow coordinator (pure, testable).
 *
 * The safe-update contract:
 *  - A reload happens ONLY after the user accepts an update (requestUpdate).
 *  - The `controllerchange` event that follows the new worker activating
 *    triggers exactly ONE reload; any further events are ignored, so a
 *    misbehaving environment can never cause a reload loop.
 *  - Unrequested controllerchange events (e.g. the very first install's
 *    clients.claim()) never reload — brand-new visitors keep their session.
 */

export const SKIP_WAITING_MESSAGE = { type: 'SKIP_WAITING' } as const;

export interface UpdateCoordinator {
  /** Called when the user accepts the update. Arms the one-shot reload. */
  requestUpdate: () => void;
  /**
   * Consulted from the `controllerchange` listener: true exactly once per
   * accepted update (the first call after requestUpdate), false otherwise.
   */
  shouldReloadOnControllerChange: () => boolean;
  /** True between accept and the (at most one) following reload. */
  isAwaitingActivation: () => boolean;
}

export function createUpdateCoordinator(): UpdateCoordinator {
  let awaiting = false;
  let reloaded = false;
  return {
    requestUpdate() {
      awaiting = true;
    },
    shouldReloadOnControllerChange() {
      if (!awaiting || reloaded) return false;
      reloaded = true;
      return true;
    },
    isAwaitingActivation() {
      return awaiting && !reloaded;
    },
  };
}
