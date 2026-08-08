/**
 * Firebase config guard — deliberately free of any `firebase/*` imports so the
 * heavy SDK never enters the main bundle. The auth store reads this
 * synchronously to know whether Firebase is configured; the SDK itself is
 * loaded via dynamic import only when it is.
 *
 * Firebase is now the app's only account backend. When it isn't configured,
 * the auth screen shows setup instructions instead of the login form — there
 * are no fake/device accounts. Guests (no account) still work.
 */
export type AuthMode = 'firebase' | 'unconfigured';

export function isFirebaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY &&
      process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN &&
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID &&
      process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  );
}

/** Which auth state this build is in. */
export function getAuthMode(): AuthMode {
  return isFirebaseConfigured() ? 'firebase' : 'unconfigured';
}
