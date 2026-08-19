import 'server-only';
import { createHash } from 'node:crypto';
import { getAdminDb } from '@/lib/firebase/admin';

export type DistributedRateLimitResult = 'allowed' | 'limited';

/** Firestore-backed fixed-window limiter shared by every server instance. */
export async function consumeDistributedRateLimit(args: {
  key: string;
  limit: number;
  windowMs: number;
  now?: number;
}): Promise<DistributedRateLimitResult> {
  const now = args.now ?? Date.now();
  const id = createHash('sha256').update(args.key).digest('hex');
  const db = getAdminDb();
  const ref = db.doc(`rate_limits/${id}`);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.data() as { windowStart?: number; count?: number } | undefined;
    if (!data || typeof data.windowStart !== 'number' || now >= data.windowStart + args.windowMs) {
      tx.set(ref, { windowStart: now, count: 1, expiresAt: now + args.windowMs });
      return 'allowed';
    }
    const count = typeof data.count === 'number' ? data.count : 0;
    if (count >= args.limit) return 'limited';
    tx.set(ref, { ...data, count: count + 1, expiresAt: data.windowStart + args.windowMs });
    return 'allowed';
  });
}

/** Prefer the platform-provided client IP; never persist the raw value. */
export function rateLimitClientKey(request: Request, fallback: string): string {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || fallback;
}
