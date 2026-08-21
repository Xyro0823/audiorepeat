import { describe, expect, it } from 'vitest';
import { summarizeErrorEvents, type AdminErrorEvent } from '@/lib/errorMonitoring/admin';

function event(overrides: Partial<AdminErrorEvent> = {}): AdminErrorEvent {
  return {
    id: 'safe-id',
    source: 'window',
    area: 'player',
    errorName: 'TypeError',
    online: true,
    visibility: 'visible',
    fingerprint: '1234567890abcdef12345678',
    release: 'abcdef123456',
    createdAt: '2026-08-20T00:00:00.000Z',
    ...overrides,
  };
}

describe('summarizeErrorEvents', () => {
  it('builds deterministic admin counts and exposes only recent sanitized rows', () => {
    const summary = summarizeErrorEvents([
      event(),
      event({ id: '2', area: 'review', errorName: 'NetworkError', online: false }),
      event({ id: '3' }),
    ]);
    expect(summary.total).toBe(3);
    expect(summary.offline).toBe(1);
    expect(summary.byArea).toEqual([
      { value: 'player', count: 2 },
      { value: 'review', count: 1 },
    ]);
    expect(summary.byErrorName[0]).toEqual({ value: 'TypeError', count: 2 });
  });
});
