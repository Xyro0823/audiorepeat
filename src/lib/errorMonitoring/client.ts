import {
  errorAreaForPath,
  safeErrorName,
  validateClientErrorReport,
  type ClientErrorReport,
  type ErrorSource,
  type ErrorVisibility,
} from '@/lib/errorMonitoring/schema';

const ERROR_ENDPOINT = '/api/errors';
const REQUEST_TIMEOUT_MS = 4_000;
const DEDUPE_WINDOW_MS = 30_000;
const recentReports = new Map<string, number>();

interface BuildReportOptions {
  source: ErrorSource;
  pathname?: string;
  online?: boolean;
  visibility?: ErrorVisibility;
}

/** Pure report builder, exported so the privacy boundary is regression-tested. */
export function buildClientErrorReport(error: unknown, options: BuildReportOptions): ClientErrorReport {
  const report: ClientErrorReport = {
    v: 1,
    source: options.source,
    area: errorAreaForPath(options.pathname ?? '/'),
    errorName: safeErrorName(error),
    online: options.online ?? true,
    visibility: options.visibility ?? 'visible',
  };
  // Callers cannot accidentally bypass the closed schema in future edits.
  return validateClientErrorReport(report) ?? {
    v: 1,
    source: options.source,
    area: 'unknown',
    errorName: 'UnknownError',
    online: true,
    visibility: 'visible',
  };
}

function browserVisibility(): ErrorVisibility {
  const state = document.visibilityState as string;
  return state === 'hidden' || state === 'prerender' ? state : 'visible';
}

function reportKey(report: ClientErrorReport): string {
  return [report.source, report.area, report.errorName, report.online, report.visibility].join('|');
}

function shouldSend(report: ClientErrorReport, now = Date.now()): boolean {
  const key = reportKey(report);
  const previous = recentReports.get(key);
  if (previous !== undefined && now - previous < DEDUPE_WINDOW_MS) return false;
  recentReports.set(key, now);
  if (recentReports.size > 50) {
    for (const [oldKey, at] of recentReports) {
      if (now - at >= DEDUPE_WINDOW_MS) recentReports.delete(oldKey);
    }
  }
  return true;
}

/** Fire-and-forget transport. Monitoring can never break the product flow. */
export function reportClientError(error: unknown, source: ErrorSource): void {
  try {
    const report = buildClientErrorReport(error, {
      source,
      pathname: window.location.pathname,
      online: navigator.onLine,
      visibility: browserVisibility(),
    });
    if (!shouldSend(report)) return;
    void sendReport(report);
  } catch {
    // Observability must always fail closed and silently.
  }
}

async function sendReport(report: ClientErrorReport): Promise<void> {
  try {
    // Dynamic import keeps instrumentation-client synchronous and lightweight.
    const { getAuthIdToken } = await import('@/lib/authStore');
    const token = await getAuthIdToken().catch(() => null);
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      await fetch(ERROR_ENDPOINT, {
        method: 'POST',
        headers,
        body: JSON.stringify(report),
        cache: 'no-store',
        keepalive: true,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  } catch {
    // No recursive reporting when the monitoring endpoint/network itself fails.
  }
}
