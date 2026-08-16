import { describe, expect, it } from 'vitest';
import { DEFAULT_RATE_LIMIT_POLICY, InMemoryRateLimiter, type RateLimitPolicy } from '@/lib/analytics/rateLimit';

const POLICY: RateLimitPolicy = { limit: 3, windowMs: 60_000, maxKeys: 100 };
const NOW = 1_000_000_000_000;

describe('InMemoryRateLimiter', () => {
  it('accepts requests below the limit', () => {
    const limiter = new InMemoryRateLimiter(POLICY);
    expect(limiter.consume('uid-a', NOW)).toBe('allowed');
    expect(limiter.consume('uid-a', NOW + 1)).toBe('allowed');
    expect(limiter.consume('uid-a', NOW + 2)).toBe('allowed'); // exactly the limit
  });

  it('rejects requests above the limit', () => {
    const limiter = new InMemoryRateLimiter(POLICY);
    limiter.consume('uid-a', NOW);
    limiter.consume('uid-a', NOW + 1);
    limiter.consume('uid-a', NOW + 2);
    expect(limiter.consume('uid-a', NOW + 3)).toBe('limited');
    expect(limiter.consume('uid-a', NOW + 4)).toBe('limited');
  });

  it('uses the default policy (60 events / 10 min) at the singleton', () => {
    expect(DEFAULT_RATE_LIMIT_POLICY).toEqual({ limit: 60, windowMs: 600_000, maxKeys: 5000 });
  });

  it('isolates limits by uid (one uid cannot exhaust another)', () => {
    const limiter = new InMemoryRateLimiter(POLICY);
    for (let i = 0; i < POLICY.limit; i += 1) limiter.consume('uid-a', NOW + i);
    expect(limiter.consume('uid-a', NOW + 99)).toBe('limited');
    expect(limiter.consume('uid-b', NOW)).toBe('allowed');
    expect(limiter.consume('uid-b', NOW + 1)).toBe('allowed');
  });

  it('lets events through again after the window expires', () => {
    const limiter = new InMemoryRateLimiter(POLICY);
    limiter.consume('uid-a', NOW);
    limiter.consume('uid-a', NOW + 1);
    limiter.consume('uid-a', NOW + 2);
    expect(limiter.consume('uid-a', NOW + 3)).toBe('limited');
    // Window elapses: the same uid gets a fresh budget.
    expect(limiter.consume('uid-a', NOW + POLICY.windowMs)).toBe('allowed');
  });

  it('a boundary-straddling burst is capped at the next window, not unbounded', () => {
    const limiter = new InMemoryRateLimiter(POLICY);
    limiter.consume('uid-a', NOW);
    limiter.consume('uid-a', NOW + 1);
    limiter.consume('uid-a', NOW + 2);
    // Just before expiry: still limited.
    expect(limiter.consume('uid-a', NOW + POLICY.windowMs - 1)).toBe('limited');
    // Right at/after expiry: fresh window.
    expect(limiter.consume('uid-a', NOW + POLICY.windowMs)).toBe('allowed');
  });

  it('keeps memory bounded and prunes expired buckets when full', () => {
    const limiter = new InMemoryRateLimiter({ limit: 2, windowMs: 10_000, maxKeys: 3 });
    // Fill with three active uids.
    expect(limiter.consume('a', NOW)).toBe('allowed');
    expect(limiter.consume('b', NOW + 1)).toBe('allowed');
    expect(limiter.consume('c', NOW + 2)).toBe('allowed');
    expect(limiter.size()).toBe(3);
    // Map is full of ACTIVE buckets → a new uid is rejected, not grown past cap.
    expect(limiter.consume('d', NOW + 3)).toBe('limited');
    expect(limiter.size()).toBe(3);
    // Time passes (b expires exactly at the boundary, a before, c still active):
    // the next consume prunes expired buckets and makes room for the new uid.
    const later = NOW + 10_001;
    expect(limiter.consume('d', later)).toBe('allowed');
    expect(limiter.size()).toBe(2); // c (active) + d (new)
    expect(limiter.consume('d', later + 1)).toBe('allowed'); // count 2 == limit
    expect(limiter.consume('d', later + 2)).toBe('limited');
  });

  it('pruneExpired only removes fully-expired buckets', () => {
    const limiter = new InMemoryRateLimiter({ limit: 5, windowMs: 10_000, maxKeys: 10 });
    limiter.consume('old', NOW);
    limiter.consume('fresh', NOW + 9_000);
    limiter.pruneExpired(NOW + 10_001);
    expect(limiter.size()).toBe(1); // 'old' pruned, 'fresh' still tracked
  });
});
