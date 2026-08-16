import { CEFR_LEVELS } from '@/types/app';
import type { CefrLevel } from '@/types/app';
import { fireOnboardingEventOnce } from '@/lib/analytics/client';

/**
 * First-time onboarding (language → level → goal → ready).
 *
 * State is scoped PER ACCOUNT via localStorage keys derived from the uid
 * (same convention as the per-account stats/streak keys in lib/auth/scopes.ts
 * — the device's IndexedDB settings are global, so account-scoped state must
 * live in scoped storage). A fresh account gets a "pending" marker the moment
 * it is created (auth store); onboarding shows only while that marker is set
 * and no completion record exists, so:
 *   - existing accounts are never forced through onboarding,
 *   - a refresh mid-flow resumes the saved selections,
 *   - a refresh after completion never re-shows it,
 *   - switching accounts never leaks another uid's state.
 */

export const ONBOARDING_VERSION = 1;

export const ONBOARDING_PENDING_KEY_PREFIX = 'audiorepeat-onboarding-pending';
export const ONBOARDING_RECORD_KEY_PREFIX = 'audiorepeat-onboarding';

export type GoalId = 'conversation' | 'travel' | 'study' | 'work' | 'vocabulary' | 'general';

export interface GoalOption {
  id: GoalId;
  label: string;
  description: string;
}

/** Learning goals offered in onboarding (intentionally small, no engine). */
export const ONBOARDING_GOALS: readonly GoalOption[] = [
  { id: 'conversation', label: 'Conversation', description: 'Chat naturally with native speakers' },
  { id: 'travel', label: 'Travel', description: 'Get by on trips, directions & dining' },
  { id: 'study', label: 'School / Study', description: 'Support coursework or exams' },
  { id: 'work', label: 'Work', description: 'Build professional vocabulary' },
  { id: 'vocabulary', label: 'Vocabulary', description: 'Grow everyday word power' },
  { id: 'general', label: 'General practice', description: 'A bit of everything' },
];

export interface OnboardingLevelOption {
  level: CefrLevel;
  label: string;
  description: string;
}

/** Levels offered in onboarding — exactly the app's supported CEFR levels. */
export const ONBOARDING_LEVELS: readonly OnboardingLevelOption[] = [
  { level: 'A1', label: 'Beginner', description: 'Everyday greetings, numbers, essential words' },
  { level: 'A2', label: 'Elementary', description: 'Basic conversations, travel, directions' },
  { level: 'B1', label: 'Intermediate', description: 'Everyday topics, opinions, expressions' },
  { level: 'B2', label: 'Upper-intermediate', description: 'Advanced discussions, abstract ideas' },
  { level: 'C1', label: 'Advanced', description: 'Mastery vocabulary, idioms, connectors' },
  { level: 'C2', label: 'Proficiency', description: 'Technical & academic mastery' },
];

export function onboardingPendingKey(uid: string): string {
  return `${ONBOARDING_PENDING_KEY_PREFIX}:${uid}`;
}

export function onboardingRecordKey(uid: string): string {
  return `${ONBOARDING_RECORD_KEY_PREFIX}:${uid}`;
}

export interface OnboardingRecord {
  /** Chosen language (normalized pack key). */
  lang?: string;
  /** Chosen CEFR level. */
  level?: CefrLevel;
  /** Chosen learning goal. */
  goal?: GoalId;
  /** True once the flow finished ("Start practicing" pressed). */
  completed?: boolean;
  /** Which onboarding version completed the flow. */
  version?: number;
}

/** True when the uid has a pending-onboarding marker. */
export function readOnboardingPending(uid: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(onboardingPendingKey(uid)) === '1';
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* Observable pending-version store                                    */
/* ------------------------------------------------------------------ */
// The pending marker is written by the auth store right after the auth state
// flips on signup, so a flow mounted on the very first render can mount a
// beat BEFORE the marker lands. The overlay therefore derives its visibility
// from this versioned, subscribable marker (useSyncExternalStore) instead of
// one-shot state: when the marker lands (or is cleared on completion) the
// store bumps and every mounted flow re-reads it — no setState-in-effect.
let pendingVersion = 0;
const pendingListeners = new Set<() => void>();

function bumpPendingVersion(): void {
  pendingVersion += 1;
  for (const l of [...pendingListeners]) l();
}

export function subscribeOnboardingPending(listener: () => void): () => void {
  pendingListeners.add(listener);
  return () => {
    pendingListeners.delete(listener);
  };
}

export function getOnboardingPendingVersion(): number {
  return pendingVersion;
}

/** Record the marker that a freshly created account should see onboarding. */
export function markOnboardingPending(uid: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(onboardingPendingKey(uid), '1');
  } catch {
    /* storage unavailable — onboarding just won't auto-show */
  }
  bumpPendingVersion();
  // Analytics: "onboarding started" is anchored to the marker write — the
  // exact moment a brand-new account enters onboarding. The marker is written
  // once per account (at signup; never on reload/resume), so this can't be
  // inflated by rerenders or refreshes. The uid-keyed dedupe covers the
  // signup + auth-listener double-write for the same account.
  fireOnboardingEventOnce(`started:${uid}`, 'onboarding_started', {});
}

export function clearOnboardingPending(uid: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(onboardingPendingKey(uid));
  } catch {
    /* ignore */
  }
  bumpPendingVersion();
}

/** Remove ALL onboarding state for a uid (account deletion). */
export function clearOnboardingState(uid: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(onboardingPendingKey(uid));
    window.localStorage.removeItem(onboardingRecordKey(uid));
  } catch {
    /* ignore */
  }
  bumpPendingVersion();
}

/** Saved in-progress/completed onboarding state for a uid, or null. */
export function readOnboardingRecord(uid: string): OnboardingRecord | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(onboardingRecordKey(uid));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed === 'object' && parsed !== null) return parsed as OnboardingRecord;
  } catch {
    /* corrupted — treat as no record */
  }
  return null;
}

/** Persist a partial record (merge) so a refresh resumes safely. */
export function saveOnboardingRecord(uid: string, patch: OnboardingRecord): void {
  if (typeof window === 'undefined') return;
  try {
    const prev = readOnboardingRecord(uid) ?? {};
    window.localStorage.setItem(onboardingRecordKey(uid), JSON.stringify({ ...prev, ...patch }));
  } catch {
    /* storage unavailable */
  }
}

/**
 * Mark onboarding complete for a uid: write the completion record and drop the
 * pending marker so it never shows again (until the next new account).
 */
export function completeOnboarding(uid: string, record: OnboardingRecord): void {
  const merged: OnboardingRecord = { ...record, completed: true, version: ONBOARDING_VERSION };
  saveOnboardingRecord(uid, merged);
  clearOnboardingPending(uid);
}

/**
 * Pure decision: show onboarding when the account is pending and has not
 * completed it. A completion record alone is enough to suppress it (covers a
 * cleared pending key), and an absent pending marker never forces existing
 * accounts through the flow.
 */
export function shouldShowOnboarding(
  pending: boolean,
  record: OnboardingRecord | null,
): boolean {
  if (!pending) return false;
  return record?.completed !== true;
}

/**
 * Heuristic for "this account was created just now" — used for Google sign-in,
 * where the popup result doesn't distinguish new vs existing. Firebase sets a
 * brand-new account's creationTime to the moment of first sign-in, so a
 * creation timestamp very close to now means a fresh account.
 */
export function isNewlyCreatedAccount(
  createdAt: number,
  now: number,
  thresholdMs = 60_000,
): boolean {
  return now - createdAt >= 0 && now - createdAt <= thresholdMs;
}

/** The six supported CEFR levels (kept here so onboarding never invents one). */
export function onboardingLevelIds(): readonly CefrLevel[] {
  return CEFR_LEVELS;
}
