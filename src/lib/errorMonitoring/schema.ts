/**
 * Privacy boundary for production client-error reports.
 *
 * Deliberately absent: message, stack, URL, query/hash, user id/email, IP,
 * user-agent and arbitrary metadata. Those fields commonly contain tokens or
 * vocabulary content. The server accepts only this closed, low-cardinality
 * schema and rejects every unknown key.
 */

export const ERROR_SOURCES = [
  'next-boundary',
  'global-boundary',
  'window',
  'unhandled-rejection',
  'admin-boundary',
] as const;

export type ErrorSource = (typeof ERROR_SOURCES)[number];

export const ERROR_AREAS = [
  'landing',
  'dashboard',
  'library',
  'player',
  'review',
  'stats',
  'checkout',
  'admin',
  'legal',
  'unknown',
] as const;

export type ErrorArea = (typeof ERROR_AREAS)[number];

export const SAFE_ERROR_NAMES = [
  'Error',
  'TypeError',
  'RangeError',
  'ReferenceError',
  'SyntaxError',
  'AbortError',
  'TimeoutError',
  'NetworkError',
  'NotAllowedError',
  'NotFoundError',
  'InvalidStateError',
  'QuotaExceededError',
  'SecurityError',
  'UnknownError',
] as const;

export type SafeErrorName = (typeof SAFE_ERROR_NAMES)[number];
export type ErrorVisibility = 'visible' | 'hidden' | 'prerender';

export interface ClientErrorReport {
  v: 1;
  source: ErrorSource;
  area: ErrorArea;
  errorName: SafeErrorName;
  online: boolean;
  visibility: ErrorVisibility;
}

const REPORT_KEYS = new Set(['v', 'source', 'area', 'errorName', 'online', 'visibility']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Strict server/client validator. Unknown keys fail closed. */
export function validateClientErrorReport(value: unknown): ClientErrorReport | null {
  if (!isRecord(value)) return null;
  if (Object.keys(value).some((key) => !REPORT_KEYS.has(key))) return null;
  if (value.v !== 1) return null;
  if (!ERROR_SOURCES.includes(value.source as ErrorSource)) return null;
  if (!ERROR_AREAS.includes(value.area as ErrorArea)) return null;
  if (!SAFE_ERROR_NAMES.includes(value.errorName as SafeErrorName)) return null;
  if (typeof value.online !== 'boolean') return null;
  if (!['visible', 'hidden', 'prerender'].includes(value.visibility as string)) return null;
  return {
    v: 1,
    source: value.source as ErrorSource,
    area: value.area as ErrorArea,
    errorName: value.errorName as SafeErrorName,
    online: value.online,
    visibility: value.visibility as ErrorVisibility,
  };
}

/** Convert a pathname to a bounded product area; never retain the path itself. */
export function errorAreaForPath(pathname: string): ErrorArea {
  const first = pathname.split('/').filter(Boolean)[0] ?? '';
  if (!first) return 'landing';
  if (first === 'dashboard') return 'dashboard';
  if (first === 'player') return 'player';
  if (first === 'review') return 'review';
  if (first === 'stats') return 'stats';
  if (first === 'checkout') return 'checkout';
  if (first === 'admin') return 'admin';
  if (first === 'privacy' || first === 'terms' || first === 'refunds') return 'legal';
  return 'unknown';
}

/** Read only the standard error class name; never read message/stack/cause. */
export function safeErrorName(error: unknown): SafeErrorName {
  if (typeof error !== 'object' || error === null) return 'UnknownError';
  try {
    const name = Reflect.get(error, 'name');
    return typeof name === 'string' && SAFE_ERROR_NAMES.includes(name as SafeErrorName)
      ? (name as SafeErrorName)
      : 'UnknownError';
  } catch {
    return 'UnknownError';
  }
}
