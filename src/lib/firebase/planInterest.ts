/**
 * Plan-purchase interest capture. Like the newsletter module, this is only
 * loaded via dynamic import (from the checkout payment step), so builds
 * without Firebase stay lean and never touch the SDK.
 *
 * Records live in the Firestore collection `plan_interest`, keyed by
 * `userId_plan_billing` with a set-merge upsert — re-expressing interest in
 * the same plan just refreshes the timestamp instead of duplicating rows.
 * This gives us a record of purchase intent to prioritize real payment
 * integration, without pretending to charge anyone.
 */
import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getFirestore, serverTimestamp, setDoc, doc, type Firestore } from 'firebase/firestore';
import { firebaseConfig } from './firebaseConfig';
import { isFirebaseConfigured } from './config';

let app: FirebaseApp | null = null;
let db: Firestore | null = null;

function getDb(): Firestore {
  if (!app) app = initializeApp(firebaseConfig);
  if (!db) db = getFirestore(app);
  return db;
}

export interface PlanInterest {
  userId: string;
  plan: string;
  billing: string;
  source: 'checkout';
  recordedAt: ReturnType<typeof serverTimestamp>;
}

/**
 * Record that a signed-in user expressed interest in a plan. Throws if
 * Firebase isn't configured or the write fails — callers show a generic,
 * non-blocking message (this is optional capture, never a charge).
 */
export async function recordPlanInterest(
  userId: string,
  plan: string,
  billing: string,
): Promise<void> {
  if (!isFirebaseConfigured()) {
    throw new Error('firebase-not-configured');
  }
  const id = `${userId}_${plan}_${billing}`;
  const ref = doc(getDb(), 'plan_interest', id);
  const data: PlanInterest = {
    userId,
    plan,
    billing,
    source: 'checkout',
    recordedAt: serverTimestamp(),
  };
  await setDoc(ref, data, { merge: true });
}
