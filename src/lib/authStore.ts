/**
 * Module-level auth store — same pattern as src/lib/settingsStore.ts.
 *
 * Firebase Authentication is the app's only account backend (Google + email/
 * password). The store exposes the current auth state to every subscriber via
 * `useSyncExternalStore` and bridges to the Firebase SDK, which is
 * dynamic-imported only when a config is present.
 *
 * When Firebase isn't configured the app has no accounts at all — guests
 * only — and the auth screen shows setup instructions.
 */
import { getAuthMode } from '@/lib/firebase/config';
import { isNewlyCreatedAccount, markOnboardingPending } from '@/lib/onboarding';
import { activateSetOwner } from '@/lib/db/indexedDb';
import { updateSettings } from '@/lib/settingsStore';
import type { AuthResult, AuthState } from '@/types/auth';

const MODE = getAuthMode();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

let state: AuthState = { status: 'loading', user: null };
let hydrated = false;
const listeners = new Set<() => void>();

function emit(): void {
  for (const l of [...listeners]) l();
}

export function subscribeAuth(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Stable snapshot for useSyncExternalStore (server snapshot = initial state). */
export function getAuthSnapshot(): AuthState {
  return state;
}

export function authHydrated(): boolean {
  return hydrated;
}

export function authMode(): 'firebase' | 'unconfigured' {
  return MODE;
}

function setState(next: AuthState): void {
  state = next;
  emit();
}

function setStateFn(updater: (prev: AuthState) => AuthState): void {
  state = updater(state);
  emit();
}

async function loadClient(): Promise<typeof import('@/lib/firebase/client')> {
  return import('@/lib/firebase/client');
}

/** Entitlements are account-scoped server state, never device-global state. */
export function resetLocalEntitlement(): void {
  updateSettings({ plan: 'basic', planBilling: 'annual', planSource: null });
}

function enterSignedInState(user: NonNullable<AuthState['user']>): void {
  // Fail closed before any asynchronous server lookup. This also prevents a
  // late response for User A from appearing during User B's session.
  resetLocalEntitlement();
  activateSetOwner(user.id);
  setState({ status: 'signed-in', user });
}

/**
 * Mirror the server-side entitlement (the source of truth) into local
 * settings so the Free/Pro gating reflects the real plan. Best-effort and
 * non-blocking: when the server layer isn't configured or the fetch fails,
 * local settings stay as they are (guests-only fallback keeps working).
 */
async function syncPlanFromServer(expectedUid: string): Promise<void> {
  try {
    const { getFirebaseIdToken } = await loadClient();
    const token = await getFirebaseIdToken();
    if (!token) return;
    const res = await fetch('/api/entitlement', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return; // already reset to Free: entitlement lookup is fail-closed
    const data = (await res.json()) as {
      plan?: string;
      billing?: string | null;
      source?: string | null;
    };
    const plan = data.plan;
    if (plan !== 'basic' && plan !== 'pro' && plan !== 'lifetime') return;
    if (state.status !== 'signed-in' || state.user?.id !== expectedUid) return;
    updateSettings({
      plan,
      planBilling: plan === 'lifetime' ? 'annual' : data.billing === 'monthly' ? 'monthly' : 'annual',
      // Neutral display source — 'manual' (gift) vs 'paddle' (billing).
      planSource: plan === 'basic' ? null : data.source === 'manual' ? 'manual' : 'paddle',
    });
  } catch {
    // Best-effort — entitlement sync must never block auth.
  }
}

/**
 * Fresh Firebase ID token for the signed-in user (null when signed out or
 * Firebase isn't configured). Used by server-authenticated calls.
 */
export async function getAuthIdToken(): Promise<string | null> {
  const { getFirebaseIdToken } = await loadClient();
  return getFirebaseIdToken();
}

/** Restore the Firebase session once (idempotent across all consumers). */
export async function hydrateAuth(): Promise<void> {
  if (hydrated) return;
  hydrated = true;
  if (MODE === 'unconfigured') {
    resetLocalEntitlement();
    setState({ status: 'guest', user: null });
    return;
  }
  try {
    const { getFirebaseAuth, onFirebaseAuthChange, firebaseUserToAuthUser } = await loadClient();
    const auth = getFirebaseAuth();
    if (!auth) {
      activateSetOwner(null);
      resetLocalEntitlement();
      setState({ status: 'guest', user: null });
      return;
    }
    // Stays 'loading' until the first callback resolves the session.
    onFirebaseAuthChange(auth, (fbUser) => {
      if (fbUser) {
        const user = firebaseUserToAuthUser(fbUser);
        // A brand-new account (creationTime ≈ now) must see onboarding. This
        // check runs SYNCHRONOUSLY with the auth-state flip that mounts the
        // app, so the dashboard's account-prefs activation can never race the
        // pending marker and wrongly adopt another session's hiddenLangs.
        if (isNewlyCreatedAccount(user.createdAt, Date.now())) {
          markOnboardingPending(user.id);
        }
        enterSignedInState(user);
        // Server entitlement is authoritative — mirror it into local settings
        // so gating uses the real plan (no-op when not configured).
        void syncPlanFromServer(user.id);
      } else {
        // Signed out. An explicit `logout()` already moved to 'signed-out'
        // (login screen); anything else (fresh visit) becomes a guest.
        resetLocalEntitlement();
        activateSetOwner(null);
        setStateFn((prev) => prev.status === 'signed-out' ? prev : { status: 'guest', user: null });
      }
    });
  } catch {
    activateSetOwner(null);
    resetLocalEntitlement();
    setState({ status: 'guest', user: null });
  }
}

const UNCONFIGURED_ERROR =
  'Firebase is not configured — add your firebaseConfig to .env.local (see .env.example).';

/** Create an account with an email + password. `displayName` is optional. */
export async function signup(
  email: string,
  password: string,
  displayName?: string,
): Promise<AuthResult> {
  const clean = email.trim();
  if (!EMAIL_RE.test(clean)) return { ok: false, error: 'Enter a valid email address.' };
  if (password.length < 6) {
    return { ok: false, error: 'Password must be at least 6 characters.' };
  }
  if (MODE === 'unconfigured') return { ok: false, error: UNCONFIGURED_ERROR };
  try {
    const { getFirebaseAuth, createEmailAccount, firebaseUserToAuthUser } = await loadClient();
    const auth = getFirebaseAuth();
    if (!auth) return { ok: false, error: UNCONFIGURED_ERROR };
    const user = await createEmailAccount(auth, clean, password, displayName);
    const mapped = firebaseUserToAuthUser(user);
    // Write the pending marker BEFORE flipping the auth state, so the first
    // mount of the app (triggered by this state change) always sees it.
    // (The Firebase auth listener also marks brand-new accounts synchronously,
    // covering mounts triggered by the listener itself.)
    markOnboardingPending(user.uid);
    enterSignedInState(mapped);
    return { ok: true };
  } catch (err) {
    const { describeFirebaseError } = await loadClient();
    return { ok: false, error: describeFirebaseError(err) };
  }
}

export async function login(email: string, password: string): Promise<AuthResult> {
  const clean = email.trim();
  if (!clean || !password) {
    return { ok: false, error: 'Enter your email and password.' };
  }
  if (MODE === 'unconfigured') return { ok: false, error: UNCONFIGURED_ERROR };
  try {
    const { getFirebaseAuth, signInEmailPassword, firebaseUserToAuthUser } = await loadClient();
    const auth = getFirebaseAuth();
    if (!auth) return { ok: false, error: UNCONFIGURED_ERROR };
    const user = await signInEmailPassword(auth, clean, password);
    enterSignedInState(firebaseUserToAuthUser(user));
    return { ok: true };
  } catch (err) {
    const { describeFirebaseError } = await loadClient();
    return { ok: false, error: describeFirebaseError(err) };
  }
}

/** Google sign-in via popup (desktop browsers; allow popups for this site). */
export async function signInWithGoogle(): Promise<AuthResult> {
  if (MODE === 'unconfigured') return { ok: false, error: UNCONFIGURED_ERROR };
  try {
    const { getFirebaseAuth, signInWithGoogle, firebaseUserToAuthUser } = await loadClient();
    const auth = getFirebaseAuth();
    if (!auth) return { ok: false, error: UNCONFIGURED_ERROR };
    const user = await signInWithGoogle(auth);
    const mapped = firebaseUserToAuthUser(user);
    // Google doesn't say whether the account is new; a creationTime very close
    // to now means it was just created, so it should see onboarding. Written
    // before the state flip (and again synchronously by the auth listener).
    if (isNewlyCreatedAccount(mapped.createdAt, Date.now())) {
      markOnboardingPending(user.uid);
    }
    enterSignedInState(mapped);
    return { ok: true };
  } catch (err) {
    const { describeFirebaseError } = await loadClient();
    return { ok: false, error: describeFirebaseError(err) };
  }
}

/** Explicit sign-out — the login screen takes over (user picks an account or guest). */
export function logout(): void {
  void import('@/lib/firebase/client')
    .then((m) => m.getFirebaseAuth()?.signOut())
    .catch(() => {
      /* sign-out failure is non-critical */
    });
  // Reset entitlement to Free so the signed-out/guest session never inherits
  // another user's cached Pro plan from the global settings store.
  resetLocalEntitlement();
  activateSetOwner(null);
  setState({ status: 'signed-out', user: null });
}

/** Dismiss the login screen and keep using the app with no account. */
export function continueAsGuest(): void {
  // Drop any lingering Firebase session so the app is truly guest.
  void import('@/lib/firebase/client')
    .then((m) => m.getFirebaseAuth()?.signOut())
    .catch(() => {
      /* non-critical */
    });
  // Reset entitlement to Free so the guest session never inherits a signed-in
  // user's cached Pro plan from the global settings store.
  resetLocalEntitlement();
  activateSetOwner(null);
  setState({ status: 'guest', user: null });
}

/** Permanently delete the active Firebase account (scoped keys are cleaned by the caller). */
export async function deleteAccount(): Promise<AuthResult> {
  try {
    const token = await getAuthIdToken();
    if (!token) return { ok: false, error: 'Please sign in again before deleting your account.' };
    const response = await fetch('/api/account', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      return { ok: false, error: data?.error ?? 'Could not delete your account.' };
    }
    const { getFirebaseAuth } = await loadClient();
    const current = getFirebaseAuth()?.currentUser;
    // The server deletes Firebase Auth last; this local call is only a safe
    // compatibility no-op when the SDK has not observed that deletion yet.
    if (current) await current.reload().catch(() => {});
    resetLocalEntitlement();
    activateSetOwner(null);
    setState({ status: 'guest', user: null });
    return { ok: true };
  } catch (err) {
    const { describeFirebaseError } = await loadClient();
    return { ok: false, error: describeFirebaseError(err) };
  }
}
