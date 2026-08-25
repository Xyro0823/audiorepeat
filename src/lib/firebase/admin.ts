/**
 * Server-only Firebase Admin layer.
 *
 * This is the "smallest appropriate server-side Firebase verification layer":
 * a lazy firebase-admin singleton (initialized only when a service-account
 * credential is present) that verifies Firebase ID tokens server-side and
 * reads/writes the Firestore entitlement records that back subscriptions and
 * Lifetime purchases.
 *
 * Environment: `FIREBASE_SERVICE_ACCOUNT` (JSON) — see `.env.example`.
 * Everything here is server-only; never import this module from client code.
 *
 * Graceful degradation: when the credential is absent, `isAdminConfigured()`
 * is false, `verifyIdToken()` returns null and `createEntitlementStore()`
 * throws — callers map that to clean 503 responses so Stripe retries and the
 * UI keeps the honest "payments not ready" placeholder.
 */
import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { getFirestore, Timestamp, type Firestore } from 'firebase-admin/firestore';
import type {
  EntitlementRecord,
  EntitlementStore,
  ManualEntitlement,
} from '@/lib/stripe/entitlements';

/** True when the admin SDK has a service-account credential to use. */
export function isAdminConfigured(): boolean {
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
  return Boolean(serviceAccount && serviceAccount.trim().length > 0);
}

function getAdminApp(): App {
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!isAdminConfigured()) {
    throw new Error('firebase-admin-not-configured');
  }
  const existing = getApps()[0];
  if (existing) return existing;
  return initializeApp({
    credential: cert(JSON.parse(serviceAccount as string)),
  });
}

/**
 * Verify a Firebase ID token and return the uid. Returns null when the token
 * is missing/invalid/expired or when the admin layer is not configured.
 */
export async function verifyIdToken(idToken: string): Promise<string | null> {
  try {
    // Sensitive server routes must reject disabled/deleted users and sessions
    // whose refresh tokens were revoked, not merely validate the JWT signature.
    const decoded = await getAuth(getAdminApp()).verifyIdToken(idToken, true);
    return decoded.uid;
  } catch {
    return null;
  }
}

export function getAdminDb(): Firestore {
  return getFirestore(getAdminApp());
}

/** Admin Auth instance (same lazy app) — used for user lookup by the admin API. */
export function getAdminAuth(): Auth {
  return getAuth(getAdminApp());
}

const ENTITLEMENTS_COLLECTION = 'entitlements';
const STRIPE_EVENTS_COLLECTION = 'stripe_events';
const PADDLE_EVENTS_COLLECTION = 'paddle_events';

/* ------------------------------------------------------------------------ */
/* Admin authorization (manual/gift entitlement management)                  */
/* ------------------------------------------------------------------------ */

/**
 * True when `uid` is on the server-side admin allowlist (`ADMIN_UIDS` — a
 * comma-separated list of Firebase UIDs). This is the ONLY admin gate for the
 * manual entitlement API; a client-supplied "isAdmin" flag is never trusted.
 * No value configured = no admins (everyone is denied).
 */
export function isAdminUid(uid: string): boolean {
  const allowlist = (process.env.ADMIN_UIDS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return allowlist.includes(uid);
}

/**
 * Authenticate an admin API request: requires the admin layer to be
 * configured, a valid Firebase ID token whose uid is on the `ADMIN_UIDS`
 * allowlist. Never trusts any client-supplied identity.
 */
export async function verifyAdminRequest(
  request: Request,
): Promise<{ ok: true; adminUid: string } | { ok: false; status: number; error: string }> {
  if (!isAdminConfigured()) {
    return { ok: false, status: 503, error: 'auth-server-not-configured' };
  }
  const auth = request.headers.get('authorization');
  const token = auth?.startsWith('Bearer ') ? auth.slice('Bearer '.length).trim() : null;
  if (!token) {
    return { ok: false, status: 401, error: 'unauthenticated' };
  }
  const uid = await verifyIdToken(token);
  if (!uid) {
    return { ok: false, status: 401, error: 'unauthenticated' };
  }
  if (!isAdminUid(uid)) {
    return { ok: false, status: 403, error: 'forbidden' };
  }
  return { ok: true, adminUid: uid };
}

/**
 * Firestore-backed entitlement store.
 *
 * - `entitlements/{uid}` — one document per user (document id == uid).
 * - webhook idempotency markers: `stripe_events/{eventId}` by default, or
 *   `paddle_events/{eventId}` when `{ events: 'paddle' }` is passed (each
 *   provider keeps its own marker collection). A document is written only
 *   AFTER the event was applied, so a retried delivery is a no-op while a
 *   failed apply is retried by the provider.
 */
export function createEntitlementStore(options?: { events?: 'stripe' | 'paddle' }): EntitlementStore {
  const db = getAdminDb();
  const eventsCollection =
    options?.events === 'paddle' ? PADDLE_EVENTS_COLLECTION : STRIPE_EVENTS_COLLECTION;

  return {
    async getEntitlement(uid) {
      const snap = await db.doc(`${ENTITLEMENTS_COLLECTION}/${uid}`).get();
      if (!snap.exists) return null;
      const data = snap.data() as Partial<EntitlementRecord>;
      return {
        uid,
        plan: data.plan ?? 'basic',
        billing: data.billing ?? null,
        stripeCustomerId: data.stripeCustomerId ?? null,
        stripeSubscriptionId: data.stripeSubscriptionId ?? null,
        stripePriceId: data.stripePriceId ?? null,
        paddleSubscriptionId: data.paddleSubscriptionId ?? null,
        paddlePriceId: data.paddlePriceId ?? null,
        paddleTransactionId: data.paddleTransactionId ?? null,
        status: data.status ?? 'active',
        currentPeriodEnd: data.currentPeriodEnd ?? null,
        manual: (data.manual as ManualEntitlement | null | undefined) ?? null,
        updatedAt: data.updatedAt ?? null,
        paddleEventAt: typeof data.paddleEventAt === 'number' ? data.paddleEventAt : null,
        stripeEventAt: typeof data.stripeEventAt === 'number' ? data.stripeEventAt : null,
      };
    },

    async putEntitlement(uid, patch) {
      await db
        .doc(`${ENTITLEMENTS_COLLECTION}/${uid}`)
        .set({ ...patch, updatedAt: Timestamp.now() }, { merge: true });
    },

    async findUidBySubscription(stripeSubscriptionId) {
      const snap = await db
        .collection(ENTITLEMENTS_COLLECTION)
        .where('stripeSubscriptionId', '==', stripeSubscriptionId)
        .limit(1)
        .get();
      if (snap.empty) return null;
      return snap.docs[0].id;
    },

    async findUidByPaddleSubscription(paddleSubscriptionId) {
      const snap = await db
        .collection(ENTITLEMENTS_COLLECTION)
        .where('paddleSubscriptionId', '==', paddleSubscriptionId)
        .limit(1)
        .get();
      if (snap.empty) return null;
      return snap.docs[0].id;
    },

    async findUidByPaddleTransaction(paddleTransactionId) {
      const snap = await db
        .collection(ENTITLEMENTS_COLLECTION)
        .where('paddleTransactionId', '==', paddleTransactionId)
        .limit(1)
        .get();
      if (snap.empty) return null;
      return snap.docs[0].id;
    },

    async isEventProcessed(eventId) {
      const snap = await db.doc(`${eventsCollection}/${eventId}`).get();
      return snap.exists;
    },

    async markEventProcessed(eventId) {
      await db
        .doc(`${eventsCollection}/${eventId}`)
        .set({ eventId, processedAt: Timestamp.now() });
    },

    async putPaddleEntitlementIfNewer(uid, patch, occurredAtMs) {
      const ref = db.doc(`${ENTITLEMENTS_COLLECTION}/${uid}`);
      return db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        const previous = snap.data()?.paddleEventAt;
        if (typeof previous === 'number' && previous >= occurredAtMs) return false;
        tx.set(ref, { ...patch, paddleEventAt: occurredAtMs, updatedAt: Timestamp.now() }, { merge: true });
        return true;
      });
    },

    async putProviderEntitlementIfNewer(uid, patch, provider, occurredAtMs) {
      const ref = db.doc(`${ENTITLEMENTS_COLLECTION}/${uid}`);
      const field = provider === 'stripe' ? 'stripeEventAt' : 'paddleEventAt';
      return db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        const previous = snap.data()?.[field];
        if (typeof previous === 'number' && previous >= occurredAtMs) return false;
        tx.set(
          ref,
          { ...patch, [field]: occurredAtMs, updatedAt: Timestamp.now() },
          { merge: true },
        );
        return true;
      });
    },
  };
}
