/**
 * Pure decision helpers for admin-gated navigation and the landing-page auth
 * action. Everything here is unit-testable without rendering React — the
 * components only map the results to markup.
 *
 * Authorization itself always stays server-side (Firebase ID token →
 * /api/admin/status → ADMIN_UIDS allowlist). These helpers only decide what
 * the UI may SHOW; they never grant access.
 */

/** Client-side admin gate for nav visibility (UX convenience only). */
export type AdminGate = 'checking' | 'admin' | 'not-admin';

/** Result of the server-side admin check (see checkAdminAccess). */
export type AdminCheckResult = 'admin' | 'forbidden' | 'server-error' | 'no-token';

/**
 * Map the server verdict to the UI gate, FAILING CLOSED: only an explicit
 * 200/admin result ever shows admin UI. Forbidden, server errors, timeouts
 * and missing tokens all hide admin links — nav visibility is convenience,
 * the server remains the real gate.
 */
export function resolveAdminStatus(result: AdminCheckResult): Exclude<AdminGate, 'checking'> {
  return result === 'admin' ? 'admin' : 'not-admin';
}

/** Auth statuses surfaced by useAuth() that the landing page cares about. */
export type LandingAuthStatus = 'loading' | 'guest' | 'signed-out' | 'signed-in';

/** The landing navbar's auth-dependent secondary action. */
export type LandingAction =
  | { kind: 'auth'; label: 'Sign in' }
  | { kind: 'link'; label: 'Dashboard'; href: '/dashboard' };

/**
 * Which secondary action the landing navbar should show for an auth state:
 * - signed-in → Dashboard link (no redundant Login)
 * - signed-out / guest → "Sign in" (opens the existing Firebase auth flow)
 * - loading → null (hide the auth-dependent action to avoid layout shift and
 *   any flash of the wrong state)
 */
export function landingAuthAction(status: LandingAuthStatus): LandingAction | null {
  if (status === 'signed-in') return { kind: 'link', label: 'Dashboard', href: '/dashboard' };
  if (status === 'loading') return null;
  return { kind: 'auth', label: 'Sign in' };
}
