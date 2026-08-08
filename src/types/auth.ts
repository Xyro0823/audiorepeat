/**
 * Authentication. Firebase Authentication (Google + email/password) is the
 * app's only account backend. Users map into this unified shape; the id is the
 * Firebase uid (used to scope stats, streak and challenge records).
 */
export interface AuthUser {
  id: string;
  /** displayName, falling back to the email prefix. */
  username: string;
  email?: string;
  /** Google profile photo, when available. */
  photoURL?: string;
  createdAt: number;
  lastLoginAt: number;
}

/**
 * - 'loading'    — Firebase session not yet restored
 * - 'guest'      — using the app without an account (default, zero friction)
 * - 'signed-in'  — an account is active (`user` is set)
 * - 'signed-out' — explicitly signed out; the login screen is shown
 */
export type AuthStatus = 'loading' | 'guest' | 'signed-in' | 'signed-out';

export interface AuthState {
  status: AuthStatus;
  user: AuthUser | null;
}

export type AuthResult = { ok: true } | { ok: false; error: string };
