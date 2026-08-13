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
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp, type Firestore } from 'firebase-admin/firestore';
import type { EntitlementRecord, EntitlementStore } from '@/lib/stripe/entitlements';

const SERVICE_ACCOUNT = process.env.FIREBASE_SERVICE_ACCOUNT;

/** True when the admin SDK has a service-account credential to use. */
export function isAdminConfigured(): boolean {
  return Boolean(SERVICE_ACCOUNT && SERVICE_ACCOUNT.trim().length > 0);
}

function getAdminApp(): App {
  if (!isAdminConfigured()) {
    throw new Error('firebase-admin-not-configured');
  }
  const existing = getApps()[0];
  if (existing) return existing;
  return initializeApp({
    credential: cert(JSON.parse(SERVICE_ACCOUNT as string)),
  });
}

/**
 * Verify a Firebase ID token and return the uid. Returns null when the token
 * is missing/invalid/expired or when the admin layer is not configured.
 */
export async function verifyIdToken(idToken: string): Promise<string | null> {
  try {
    const decoded = await getAuth(getAdminApp()).verifyIdToken(idToken);
    return decoded.uid;
  } catch {
    return null;
  }
}

export function getAdminDb(): Firestore {
  return getFirestore(getAdminApp());
}

const ENTITLEMENTS_COLLECTION = 'entitlements';
const STRIPE_EVENTS_COLLECTION = 'stripe_events';
const PADDLE_EVENTS_COLLECTION = 'paddle_events';

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
        status: data.status ?? 'active',
        currentPeriodEnd: data.currentPeriodEnd ?? null,
        updatedAt: data.updatedAt ?? null,
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

    async isEventProcessed(eventId) {
      const snap = await db.doc(`${eventsCollection}/${eventId}`).get();
      return snap.exists;
    },

    async markEventProcessed(eventId) {
      await db
        .doc(`${eventsCollection}/${eventId}`)
        .set({ eventId, processedAt: Timestamp.now() });
    },
  };
}
