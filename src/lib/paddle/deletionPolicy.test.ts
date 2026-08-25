import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  LIVE_PADDLE_SUBSCRIPTION_STATUSES,
  cancelPaddleSubscriptionNow,
} from './server';

const route = readFileSync(
  join(process.cwd(), 'src/app/api/account/route.ts'),
  'utf8',
);

describe('paddle deletion-cancellation policy', () => {
  it('treats every billable/resumable status as live and skips canceled', () => {
    for (const status of ['active', 'trialing', 'past_due', 'grace', 'paused']) {
      expect(LIVE_PADDLE_SUBSCRIPTION_STATUSES.has(status), status).toBe(true);
    }
    for (const safe of ['canceled']) {
      expect(LIVE_PADDLE_SUBSCRIPTION_STATUSES.has(safe), safe).toBe(false);
    }
  });

  it('fails closed: cancellation errors never report success', async () => {
    // No Paddle API key in the test environment → the SDK call throws → 'failed'.
    const prev = process.env.PADDLE_API_KEY;
    delete process.env.PADDLE_API_KEY;
    try {
      await expect(cancelPaddleSubscriptionNow('sub_test')).resolves.toBe('failed');
    } finally {
      if (prev !== undefined) process.env.PADDLE_API_KEY = prev;
    }
  });

  it('deletion route cancels billing BEFORE any data is deleted', () => {
    const guardIndex = route.indexOf('LIVE_PADDLE_SUBSCRIPTION_STATUSES.has');
    const cancelIndex = route.indexOf('await cancelPaddleSubscriptionNow');
    const batchCommit = route.indexOf('batch.commit()');
    expect(guardIndex).toBeGreaterThan(-1);
    expect(cancelIndex).toBeGreaterThan(guardIndex);
    expect(batchCommit).toBeGreaterThan(cancelIndex);
  });

  it('blocks deletion (409) when verification or cancellation fails', () => {
    expect(route).toContain("result !== 'canceled'");
    expect(route).toMatch(/could not cancel your subscription[\s\S]{0,120}\{ status: 409/);
    expect(route).toContain("if (!isPaddleConfigured())");
  });

  it('only a verified canceled status proceeds; local record is updated too', () => {
    expect(route).toContain("paddleCanceledAt: Date.now()");
    expect(route).toContain("status: 'canceled'");
  });

  it('never restores a stale active entitlement on auth-delete rollback', () => {
    expect(route).toMatch(
      /snapshot\.ref\.path === entitlementRef\.path[\s\S]{0,200}status: 'canceled'/,
    );
  });

  it('lifetime users pass through: no recurring subscription to cancel', () => {
    // Lifetime grants have plan 'lifetime' with NO paddleSubscriptionId —
    // the guard keys off paddleSubscriptionId, so lifetime is untouched.
    expect(route).toContain('record?.paddleSubscriptionId && LIVE_PADDLE_SUBSCRIPTION_STATUSES');
    expect(route).not.toContain("'lifetime' ===");
  });

  it('keeps webhook idempotency intact (no changes to event markers here)', () => {
    const webhook = readFileSync(
      join(process.cwd(), 'src/app/api/paddle/webhook/route.ts'),
      'utf8',
    );
    expect(webhook).toContain('isEventProcessed');
    expect(route).not.toContain('isEventProcessed');
  });
});
