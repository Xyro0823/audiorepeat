import { describe, expect, it } from 'vitest';
import {
  buildWebhookFailureRecord,
  failureDocId,
  safeEventType,
  safeWebhookFailureRow,
  summarizeWebhookFailures,
} from './webhookFailures';

const HOUR = new Date('2026-08-25T14:07:33Z');

describe('safeEventType', () => {
  it('passes through processed event types', () => {
    expect(safeEventType('transaction.completed')).toBe('transaction.completed');
    expect(safeEventType('subscription.past_due')).toBe('subscription.past_due');
  });

  it('collapses unknown/untrusted types into one bucket', () => {
    expect(safeEventType('adjustment.created')).toBe('unknown');
    expect(safeEventType(42)).toBe('unknown');
    expect(safeEventType(undefined)).toBe('unknown');
  });
});

describe('failureDocId (retry dedup)', () => {
  it('gives the same event+stage one id across Paddle retries', () => {
    const a = failureDocId('processing-failed', 'evt_123', 'apply', HOUR);
    const b = failureDocId('processing-failed', 'evt_123', 'apply', new Date('2026-08-26T09:00:00Z'));
    expect(a).toBe(b);
    expect(a).toMatch(/^pf:[0-9a-f]{32}$/);
    expect(a).not.toContain('evt_'); // raw event ids are never stored verbatim
  });

  it('separates distinct events and stages', () => {
    const base = failureDocId('processing-failed', 'evt_1', 'apply', HOUR);
    expect(failureDocId('processing-failed', 'evt_2', 'apply', HOUR)).not.toBe(base);
    expect(failureDocId('processing-failed', 'evt_1', 'verify', HOUR)).not.toBe(base);
  });

  it('bounds invalid-signature records to hourly buckets', () => {
    const early = failureDocId('invalid-signature', null, 'verify', HOUR);
    const sameHour = failureDocId('invalid-signature', null, 'verify', new Date('2026-08-25T14:59:00Z'));
    const nextHour = failureDocId('invalid-signature', null, 'verify', new Date('2026-08-25T15:01:00Z'));
    expect(sameHour).toBe(early);
    expect(nextHour).not.toBe(early);
    expect(early).toMatch(/^isig:2026-08-25T14$/);
  });
});

describe('buildWebhookFailureRecord (privacy boundary)', () => {
  it('stores only the closed, sanitized key set', () => {
    const error = Object.assign(new TypeError('contains secret@example.com token=abc'), {
      stack: 'at /server/secret/path',
    });
    const record = buildWebhookFailureRecord({
      kind: 'processing-failed',
      stage: 'apply',
      error,
      eventType: 'transaction.completed',
    });
    expect(Object.keys(record).sort()).toEqual(['errorName', 'eventType', 'kind', 'stage', 'v']);
    expect(record).toEqual({
      v: 1,
      kind: 'processing-failed',
      eventType: 'transaction.completed',
      stage: 'apply',
      errorName: 'TypeError',
    });
    // Message/stack content never leaks into any field.
    expect(JSON.stringify(record)).not.toContain('secret');
    expect(JSON.stringify(record)).not.toContain('token');
  });

  it('sanitizes exotic errors and unknown event types', () => {
    const record = buildWebhookFailureRecord({
      kind: 'processing-failed',
      stage: 'apply',
      error: 'a raw string with payment details',
      eventType: 'mystery.event',
    });
    expect(record.errorName).toBe('UnknownError');
    expect(record.eventType).toBe('unknown');
  });

  it('falls back safely on malformed inputs', () => {
    expect(
      buildWebhookFailureRecord({ kind: 'bogus' as never, stage: 'nope' as never, error: null }),
    ).toEqual({ v: 1, kind: 'processing-failed', eventType: 'unknown', stage: 'apply', errorName: 'UnknownError' });
  });
});

describe('safeWebhookFailureRow (admin read-back validation)', () => {
  const valid = {
    kind: 'processing-failed',
    eventType: 'transaction.completed',
    stage: 'apply',
    errorName: 'TypeError',
    count: 3,
    updatedAt: {
      toMillis: () => Date.UTC(2026, 7, 25, 12, 0, 0),
    },
  };

  it('accepts a well-formed Firestore doc', () => {
    const row = safeWebhookFailureRow('pf:abc', valid);
    expect(row).toEqual({
      id: 'pf:abc',
      kind: 'processing-failed',
      eventType: 'transaction.completed',
      stage: 'apply',
      errorName: 'TypeError',
      count: 3,
      updatedAt: '2026-08-25T12:00:00.000Z',
    });
  });

  it('rejects malformed or hostile docs', () => {
    expect(safeWebhookFailureRow('x', null)).toBeNull();
    expect(safeWebhookFailureRow('x', { ...valid, kind: 'weird' })).toBeNull();
    expect(safeWebhookFailureRow('x', { ...valid, errorName: 'Error: leaked message' })).toBeNull();
    expect(safeWebhookFailureRow('x', { ...valid, count: 0 })).toBeNull();
    expect(safeWebhookFailureRow('x', { ...valid, count: 99_999 })).toBeNull();
    expect(safeWebhookFailureRow('x', { ...valid, updatedAt: '2026-08-25' })).toBeNull();
  });
});

describe('summarizeWebhookFailures (admin states)', () => {
  it('healthy empty state', () => {
    const summary = summarizeWebhookFailures([], { windowDays: 7 });
    expect(summary).toEqual({
      windowDays: 7,
      totalEvents: 0,
      totalRecords: 0,
      invalidSignatures: 0,
      truncated: false,
      byEventType: [],
      latest: [],
    });
  });

  it('aggregates retries by event type and flags signature failures', () => {
    const rows = [
      {
        id: 'a',
        kind: 'processing-failed' as const,
        eventType: 'transaction.completed',
        stage: 'apply' as const,
        errorName: 'TypeError' as const,
        count: 4,
        updatedAt: '2026-08-25T10:00:00.000Z',
      },
      {
        id: 'b',
        kind: 'invalid-signature' as const,
        eventType: 'unknown',
        stage: 'verify' as const,
        errorName: 'SecurityError' as const,
        count: 2,
        updatedAt: '2026-08-25T11:00:00.000Z',
      },
    ];
    const summary = summarizeWebhookFailures(rows);
    expect(summary.totalEvents).toBe(6);
    expect(summary.invalidSignatures).toBe(2);
    expect(summary.byEventType).toEqual([
      { value: 'transaction.completed', count: 4 },
      { value: 'unknown', count: 2 },
    ]);
    // Latest first for the admin table.
    expect(summary.latest.map((r) => r.id)).toEqual(['b', 'a']);
  });
});
