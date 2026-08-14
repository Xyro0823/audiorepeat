/**
 * Defense-in-depth: privileged responses must never be stored by the browser,
 * the service worker, or any intermediate cache. The service worker already
 * excludes these paths at the fetch layer; this header makes the intent
 * explicit on the wire (and covers non-service-worker clients).
 */
export const NO_STORE_HEADERS: Record<string, string> = {
  'Cache-Control': 'no-store',
};
