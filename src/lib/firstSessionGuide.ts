/**
 * Contextual first-practice guidance.
 *
 * The four-step onboarding flow answers "what should I learn?". This record
 * belongs to the separate, in-player guide that answers "how do I practise?".
 * It is deliberately scoped to the Firebase uid so switching accounts on a
 * shared device never leaks completion or progress between people.
 */

export const FIRST_SESSION_GUIDE_VERSION = 1;
export const FIRST_SESSION_GUIDE_KEY_PREFIX = 'audiorepeat:first-session-guide';
export const FIRST_SESSION_GUIDE_STEP_COUNT = 3;

export interface FirstSessionGuideRecord {
  version: number;
  step: number;
  dismissed: boolean;
}

const listeners = new Set<() => void>();
const volatileSnapshots = new Map<string, string>();

export function firstSessionGuideKey(uid: string): string {
  return `${FIRST_SESSION_GUIDE_KEY_PREFIX}:${uid}`;
}

export function normalizeFirstSessionGuideStep(step: unknown): number {
  if (typeof step !== 'number' || !Number.isFinite(step)) return 0;
  return Math.min(FIRST_SESSION_GUIDE_STEP_COUNT - 1, Math.max(0, Math.trunc(step)));
}

export function parseFirstSessionGuideRecord(raw: string | null): FirstSessionGuideRecord {
  if (!raw) {
    return { version: FIRST_SESSION_GUIDE_VERSION, step: 0, dismissed: false };
  }

  try {
    const value = JSON.parse(raw) as Partial<FirstSessionGuideRecord> | null;
    if (!value || typeof value !== 'object') throw new Error('Invalid guide record');
    return {
      version:
        typeof value.version === 'number' && Number.isFinite(value.version)
          ? Math.trunc(value.version)
          : FIRST_SESSION_GUIDE_VERSION,
      step: normalizeFirstSessionGuideStep(value.step),
      dismissed: value.dismissed === true,
    };
  } catch {
    return { version: FIRST_SESSION_GUIDE_VERSION, step: 0, dismissed: false };
  }
}

export interface FirstSessionGuideEligibility {
  pathname: string;
  onboardingPending: boolean;
  onboardingCompleted: boolean;
  dismissed: boolean;
}

/** Pure visibility rule, kept outside React so the account/route gates are testable. */
export function shouldShowFirstSessionGuide({
  pathname,
  onboardingPending,
  onboardingCompleted,
  dismissed,
}: FirstSessionGuideEligibility): boolean {
  return (
    pathname === '/player' &&
    onboardingCompleted &&
    !onboardingPending &&
    !dismissed
  );
}

/** Stable primitive snapshot for useSyncExternalStore. */
export function getFirstSessionGuideSnapshot(uid: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return (
      window.localStorage.getItem(firstSessionGuideKey(uid)) ??
      volatileSnapshots.get(uid) ??
      null
    );
  } catch {
    return volatileSnapshots.get(uid) ?? null;
  }
}

function emit(): void {
  for (const listener of [...listeners]) listener();
}

function onStorage(event: StorageEvent): void {
  if (event.key?.startsWith(`${FIRST_SESSION_GUIDE_KEY_PREFIX}:`)) emit();
}

export function subscribeFirstSessionGuide(listener: () => void): () => void {
  listeners.add(listener);
  if (typeof window !== 'undefined' && listeners.size === 1) {
    window.addEventListener('storage', onStorage);
  }

  return () => {
    listeners.delete(listener);
    if (typeof window !== 'undefined' && listeners.size === 0) {
      window.removeEventListener('storage', onStorage);
    }
  };
}

function writeFirstSessionGuide(uid: string, record: FirstSessionGuideRecord): void {
  if (typeof window === 'undefined') return;
  const serialized = JSON.stringify(record);
  try {
    window.localStorage.setItem(firstSessionGuideKey(uid), serialized);
    volatileSnapshots.delete(uid);
  } catch {
    // Storage may be blocked. Keep the current tab dismissible without ever
    // falling back to another account's record.
    volatileSnapshots.set(uid, serialized);
  }
  emit();
}

export function saveFirstSessionGuideStep(uid: string, step: number): void {
  writeFirstSessionGuide(uid, {
    version: FIRST_SESSION_GUIDE_VERSION,
    step: normalizeFirstSessionGuideStep(step),
    dismissed: false,
  });
}

export function dismissFirstSessionGuide(uid: string): void {
  const current = parseFirstSessionGuideRecord(getFirstSessionGuideSnapshot(uid));
  writeFirstSessionGuide(uid, {
    version: FIRST_SESSION_GUIDE_VERSION,
    step: current.step,
    dismissed: true,
  });
}
