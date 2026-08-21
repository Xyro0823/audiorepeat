import type {
  ErrorArea,
  ErrorSource,
  ErrorVisibility,
  SafeErrorName,
} from '@/lib/errorMonitoring/schema';

export interface AdminErrorEvent {
  id: string;
  source: ErrorSource;
  area: ErrorArea;
  errorName: SafeErrorName;
  online: boolean;
  visibility: ErrorVisibility;
  fingerprint: string;
  release: string;
  createdAt: string;
}

export interface ErrorCount {
  value: string;
  count: number;
}

export interface ErrorMonitoringSummary {
  windowDays: number;
  total: number;
  truncated: boolean;
  offline: number;
  byArea: ErrorCount[];
  byErrorName: ErrorCount[];
  latest: AdminErrorEvent[];
}

function counts(values: string[]): ErrorCount[] {
  const map = new Map<string, number>();
  for (const value of values) map.set(value, (map.get(value) ?? 0) + 1);
  return [...map.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}

/** Pure aggregation for the admin UI; events already contain only safe fields. */
export function summarizeErrorEvents(
  events: AdminErrorEvent[],
  options: { windowDays?: number; truncated?: boolean } = {},
): ErrorMonitoringSummary {
  return {
    windowDays: options.windowDays ?? 7,
    total: events.length,
    truncated: options.truncated ?? false,
    offline: events.filter((event) => !event.online).length,
    byArea: counts(events.map((event) => event.area)),
    byErrorName: counts(events.map((event) => event.errorName)),
    latest: events.slice(0, 50),
  };
}
