/**
 * Tiny shared store for the browser's `beforeinstallprompt` event.
 *
 * `InstallPrompt` captures the event here the moment the browser fires it, and
 * both the corner-toast nudge and the Tools-menu "Install app" action read the
 * same source of truth — so the affordance lives in the header without a
 * second copy of the event. The event is one-shot: `requestInstall` consumes
 * it (like Chrome's own prompt).
 */
export interface InstallEvent {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let installEvent: InstallEvent | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  for (const l of [...listeners]) l();
}

export function subscribeInstall(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Stable snapshot for useSyncExternalStore (server snapshot = null). */
export function getInstallSnapshot(): InstallEvent | null {
  return installEvent;
}

export function captureInstallEvent(e: InstallEvent): void {
  installEvent = e;
  emit();
}

export function clearInstallEvent(): void {
  installEvent = null;
  emit();
}

/** Show the native install dialog and consume the (one-shot) event. */
export function requestInstall(): Promise<void> {
  const e = installEvent;
  if (!e) return Promise.resolve();
  installEvent = null;
  emit();
  return e
    .prompt()
    .then(() => e.userChoice)
    .then(() => {
      /* outcome handled via the `appinstalled` event */
    })
    .catch(() => {
      /* user dismissed / prompt unavailable — nothing to do */
    });
}
