import { describe, expect, it } from 'vitest';
import {
  errorAreaForPath,
  safeErrorName,
  validateClientErrorReport,
} from '@/lib/errorMonitoring/schema';
import { buildClientErrorReport } from '@/lib/errorMonitoring/client';

const valid = {
  v: 1,
  source: 'window',
  area: 'player',
  errorName: 'TypeError',
  online: true,
  visibility: 'visible',
} as const;

describe('client error privacy schema', () => {
  it('accepts only the closed, low-cardinality report', () => {
    expect(validateClientErrorReport(valid)).toEqual(valid);
  });

  it.each(['message', 'stack', 'url', 'token', 'uid', 'email', 'userAgent', 'word'])(
    'rejects a report containing sensitive/arbitrary %s data',
    (key) => {
      expect(validateClientErrorReport({ ...valid, [key]: 'do-not-store-me' })).toBeNull();
    },
  );

  it('rejects arbitrary classes, paths and even plausible opaque client fields', () => {
    expect(validateClientErrorReport({ ...valid, errorName: 'secret@example.com' })).toBeNull();
    expect(validateClientErrorReport({ ...valid, area: '/player?token=secret' })).toBeNull();
    expect(validateClientErrorReport({ ...valid, digest: '123456789' })).toBeNull();
  });

  it('reduces routes to fixed product areas without query/hash retention', () => {
    expect(errorAreaForPath('/player?set=user-content#word')).toBe('unknown');
    expect(errorAreaForPath('/player')).toBe('player');
    expect(errorAreaForPath('/admin/errors')).toBe('admin');
    expect(errorAreaForPath('/privacy')).toBe('legal');
  });

  it('reads only an allowlisted error class and never serializes message or stack', () => {
    const error = new TypeError('private vocabulary and token');
    error.stack = 'private stack';
    expect(safeErrorName(error)).toBe('TypeError');
    const report = buildClientErrorReport(error, {
      source: 'next-boundary',
      pathname: '/review',
      online: false,
      visibility: 'hidden',
    });
    const wire = JSON.stringify(report);
    expect(report.area).toBe('review');
    expect(wire).not.toContain('private');
    expect(wire).not.toMatch(/message|stack|token/i);
  });
});
