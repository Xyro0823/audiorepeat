/**
 * Analytics write rate limiter — bounded, in-memory, best-effort.
 *
 * Purpose: stop one authenticated client from trivially flooding the
 * `analytics_events` collection or distorting onboarding aggregates.
 *
 * Design notes (read before changing):
 *   - Keyed by the VERIFIED Firebase uid (from the server-side token check).
 *     The uid is used ONLY as an enforcement key — it is never stored in
 *     Firestore and never returned to the client. The client cannot spoof it
 *     (the payload schema has no uid field and the key comes from the token).
 *   - Fixed-window policy: `limit` events per `windowMs` per uid. Simple and
 *     matches the product reality (a full onboarding session is ~8 events, so
 *     60/10min is generous headroom). A burst straddling a window boundary can
 *     momentarily allow up to 2× — acceptable for this use.
 *   - Memory is bounded: at most `maxKeys` uids are tracked; expired buckets
 *     are pruned when the map fills, and a full map of active buckets rejects
 *     NEW uids rather than growing.
 *   - NO IPs, cookies, fingerprints, or distributed coordination. This is a
 *     per-process/per-isolate limiter: on serverless platforms each isolate
 *     keeps its own counters, so the effective cap is `limit × instances`
 *     per window. It is best-effort abuse damping, NOT a globally strict
 *     distributed quota. The privacy design (aggregate, non-identifying
 *     events) is what makes that acceptable.
 */

export interface RateLimitPolicy {
  /** Max events per uid per window (after validation, before store). */
  limit: number;
  /** Window length in ms. */
  windowMs: number;
  /** Max distinct uids tracked — hard bound on memory. */
  maxKeys: number;
}

export const DEFAULT_RATE_LIMIT_POLICY: RateLimitPolicy = {
  limit: 60,
  windowMs: 10 * 60_000,
  maxKeys: 5000,
};

export type RateLimitResult = 'allowed' | 'limited';

interface Bucket {
  windowStart: number;
  count: number;
}

export class InMemoryRateLimiter {
  private readonly buckets = new Map<string, Bucket>();

  constructor(private readonly policy: RateLimitPolicy = DEFAULT_RATE_LIMIT_POLICY) {}

  /**
   * Try to consume one slot for `key` at time `now`. Returns 'allowed' and
   * increments the counter, or 'limited' when the window budget is exhausted.
   * Expired buckets reset lazily on access; the map is pruned when it fills.
   */
  consume(key: string, now = Date.now()): RateLimitResult {
    const { limit, windowMs, maxKeys } = this.policy;

    if (this.buckets.size >= maxKeys) {
      this.pruneExpired(now);
    }

    const bucket = this.buckets.get(key);
    if (!bucket) {
      if (this.buckets.size >= maxKeys) {
        // Still full of ACTIVE buckets — bound memory instead of growing.
        return 'limited';
      }
      this.buckets.set(key, { windowStart: now, count: 1 });
      return 'allowed';
    }

    if (now >= bucket.windowStart + windowMs) {
      bucket.windowStart = now;
      bucket.count = 1;
      return 'allowed';
    }

    if (bucket.count < limit) {
      bucket.count += 1;
      return 'allowed';
    }

    return 'limited';
  }

  /** Drop buckets whose window has fully elapsed (bounded memory). */
  pruneExpired(now: number): void {
    const { windowMs } = this.policy;
    for (const [key, bucket] of this.buckets) {
      if (now >= bucket.windowStart + windowMs) {
        this.buckets.delete(key);
      }
    }
  }

  /** Number of currently tracked uids (tests + observability). */
  size(): number {
    return this.buckets.size;
  }
}

/** Singleton used by the API route (one per server instance / isolate). */
export const analyticsRateLimiter = new InMemoryRateLimiter();
