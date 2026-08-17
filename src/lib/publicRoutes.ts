/**
 * Routes that must render without an authenticated session.
 *
 * The marketing landing page (`/`) and the public legal pages are reachable
 * while signed out. Everything else in the app goes through the auth gate.
 *
 * Keep this list small and deliberate — adding a route here makes it public.
 */
export const PUBLIC_PATHS: readonly string[] = [
  "/",
  "/privacy",
  "/terms",
  "/refunds",
];

/** True when `pathname` may be served to signed-out visitors. */
export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.includes(pathname);
}
