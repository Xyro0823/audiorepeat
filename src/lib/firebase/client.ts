/**
 * Firebase Authentication client. This module is only ever loaded via dynamic
 * import from the auth store when `isFirebaseConfigured()` is true, so builds
 * without Firebase stay lean and never touch the SDK.
 *
 * Standard Firebase setup, exactly as the console quickstart describes:
 *
 *   const app = initializeApp(firebaseConfig);
 *   export const auth = getAuth(app);
 *
 * Because init is lazy (module-level `auth` is populated on first use), `auth`
 * is exported as a live binding — after any helper here runs (or
 * `initFirebase()` is called explicitly), `auth` holds the initialized
 * instance.
 */
import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
  createUserWithEmailAndPassword,
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  updateProfile,
  type Auth,
  type User,
  type Unsubscribe,
} from 'firebase/auth';
import { firebaseConfig } from './firebaseConfig';
import { isFirebaseConfigured } from './config';
import type { AuthUser } from '@/types/auth';

let app: FirebaseApp | null = null;
let auth: Auth | null = null;

/** Initialize the Firebase app + auth singleton (idempotent). */
export function initFirebase(): { app: FirebaseApp; auth: Auth } {
  if (!app || !auth) {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
  }
  return { app, auth };
}

export function getFirebaseAuth(): Auth | null {
  return isFirebaseConfigured() ? initFirebase().auth : null;
}

/** Live binding — populated after the first init (see module docstring). */
export { auth };

/** Map a Firebase user into the app's unified AuthUser shape. */
export function firebaseUserToAuthUser(fb: User): AuthUser {
  const email = fb.email ?? undefined;
  return {
    id: fb.uid,
    username: fb.displayName?.trim() || (email ? email.split('@')[0] : 'Firebase user') || 'Firebase user',
    email,
    photoURL: fb.photoURL ?? undefined,
    createdAt: fb.metadata.creationTime ? Date.parse(fb.metadata.creationTime) : Date.now(),
    lastLoginAt: Date.now(),
  };
}

/** Subscribe to Firebase auth state; returns an unsubscribe function. */
export function onFirebaseAuthChange(a: Auth, cb: (user: User | null) => void): Unsubscribe {
  return onAuthStateChanged(a, cb);
}

export async function signInWithGoogle(a: Auth): Promise<User> {
  const provider = new GoogleAuthProvider();
  const cred = await signInWithPopup(a, provider);
  return cred.user;
}

export async function createEmailAccount(
  a: Auth,
  email: string,
  password: string,
  displayName?: string,
): Promise<User> {
  const cred = await createUserWithEmailAndPassword(a, email, password);
  const name = displayName?.trim();
  if (name && cred.user) {
    await updateProfile(cred.user, { displayName: name }).catch(() => {
      /* non-critical — the email prefix is used as a fallback name */
    });
  }
  return cred.user;
}

export async function signInEmailPassword(a: Auth, email: string, password: string): Promise<User> {
  const cred = await signInWithEmailAndPassword(a, email, password);
  return cred.user;
}

/** Friendly messages for common Firebase auth error codes. */
export function describeFirebaseError(err: unknown): string {
  const code = (err as { code?: string })?.code ?? '';
  // Firebase appends the reason to the code (e.g. auth/api-key-not-valid.-please-…),
  // so match the prefix for the invalid-key case.
  if (code.startsWith('auth/api-key-not-valid')) {
    return 'Firebase is not configured correctly — check your API key in .env.local.';
  }
  switch (code) {
    case 'auth/invalid-email':
      return 'That email address looks invalid.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Incorrect email or password.';
    case 'auth/email-already-in-use':
      return 'An account with that email already exists.';
    case 'auth/weak-password':
      return 'Password must be at least 6 characters.';
    case 'auth/operation-not-allowed':
      return 'Email/password sign-in is not enabled in this Firebase project.';
    case 'auth/popup-closed-by-user':
      return 'The sign-in popup was closed.';
    case 'auth/cancelled-popup-request':
    case 'auth/popup-blocked':
      return 'The sign-in popup was blocked — allow popups for this site.';
    case 'auth/network-request-failed':
      return 'Network error — Firebase needs an internet connection.';
    case 'auth/requires-recent-login':
      return 'Please sign in again, then try deleting the account.';
    case 'auth/unauthorized-domain':
      return 'This domain is not authorized — add it in the Firebase console (Authentication → Settings).';
    default:
      return err instanceof Error && err.message ? err.message : 'Something went wrong.';
  }
}
