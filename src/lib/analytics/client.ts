/**
 * Onboarding analytics — browser transport.
 *
 * Fire-and-forget by design: sending an event NEVER blocks or breaks the
 * onboarding flow. Every failure (no token, offline, timeout, server error,
 * validation) is swallowed — callers use `void fireOnboardingEvent(...)` and
 * never await or catch.
 *
 * The POST is authenticated with the signed-in user's Firebase ID token
 * (Bearer). The server verifies it to reject anonymous spam but does NOT store
 * the uid — events remain aggregate, non-identifying product telemetry.
 *
 * Dedupe is in-memory only (module scope, per page load): no cookies, no
 * localStorage identifiers, no fingerprinting. `fireOnboardingEventOnce` is
 * used for state-transition events (started/ready) so React rerenders can
 * never inflate counts; refresh-safety comes from WHERE the call is anchored
 * (e.g. `onboarding_started` fires at the pending-marker write, which happens
 * once per account, never on reload).
 */
import { getAuthIdToken } from '@/lib/authStore';
import {
  validateOnboardingEvent,
  type OnboardingEventName,
  type OnboardingEventPayload,
  type OnboardingEventProperties,
} from '@/lib/analytics/events';

const ANALYTICS_ENDPOINT = '/api/analytics/onboarding';
/** Bounded request — analytics must never hang the tab. */
const REQUEST_TIMEOUT_MS = 4000;

const firedKeys = new Set<string>();

/** True when a dedupe key has already fired this page session. */
export function onboardingEventHasFired(key: string): boolean {
  return firedKeys.has(key);
}

/** Record a dedupe key as fired (call BEFORE firing, to stay reentrant-safe). */
export function markOnboardingEventFired(key: string): void {
  firedKeys.add(key);
}

/** Build the canonical wire payload, or null when invalid (never sent). */
export function buildOnboardingEvent<N extends OnboardingEventName>(
  event: N,
  properties: OnboardingEventProperties<N>,
): OnboardingEventPayload | null {
  return validateOnboardingEvent({ event, properties });
}

/**
 * Fire one event, deduped by `key` for this page session. No-op when the key
 * already fired — safe to call from render-adjacent code and double-invoked
 * effects (React StrictMode) without inflating counts.
 */
export function fireOnboardingEventOnce<N extends OnboardingEventName>(
  key: string,
  event: N,
  properties: OnboardingEventProperties<N>,
): void {
  if (firedKeys.has(key)) return;
  firedKeys.add(key);
  fireOnboardingEvent(event, properties);
}

/** Fire one event unconditionally (callers own dedupe). Never throws. */
export function fireOnboardingEvent<N extends OnboardingEventName>(
  event: N,
  properties: OnboardingEventProperties<N>,
): void {
  void sendOnboardingEvent(event, properties);
}

async function sendOnboardingEvent<N extends OnboardingEventName>(
  event: N,
  properties: OnboardingEventProperties<N>,
): Promise<void> {
  try {
    // Signed-in only (onboarding is signed-in only); no token → drop silently.
    const token = await getAuthIdToken();
    if (!token) return;
    const payload = buildOnboardingEvent(event, properties);
    if (!payload) return;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      await fetch(ANALYTICS_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
        cache: 'no-store',
        signal: controller.signal,
      });
      // Response status is deliberately ignored: a 4xx/5xx just means the
      // event was dropped — onboarding must never be affected by analytics.
    } finally {
      clearTimeout(timer);
    }
  } catch {
    // Fire-and-forget contract: analytics failures are invisible to the app.
  }
}
