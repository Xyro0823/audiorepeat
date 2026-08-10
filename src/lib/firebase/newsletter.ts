/**
 * Newsletter subscription writes. Like the auth client, this module is only
 * loaded via dynamic import (from NewsletterForm on submit), so builds
 * without Firebase stay lean and never touch the SDK.
 *
 * Subscribers are stored in the Firestore collection `newsletter_subscribers`
 * keyed by the lowercased email as the document ID — a set-merge upsert, so
 * re-subscribing the same address updates the entry instead of duplicating it.
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

export interface NewsletterSubscriber {
  email: string;
  subscribedAt: ReturnType<typeof serverTimestamp>;
  source: 'landing_footer';
}

/**
 * Record a newsletter subscription. The email (sanitized: trimmed +
 * lowercased) is used as the document ID with merge, so duplicate signups for
 * the same address are idempotent and never create extra documents. Throws if
 * Firebase isn't configured or the write fails — callers surface a generic
 * error to the user.
 */
export async function subscribeToNewsletter(email: string): Promise<void> {
  if (!isFirebaseConfigured()) {
    throw new Error('firebase-not-configured');
  }
  const clean = email.trim().toLowerCase();
  if (!clean) {
    throw new Error('empty-email');
  }
  const ref = doc(getDb(), 'newsletter_subscribers', clean);
  const data: NewsletterSubscriber = {
    email: clean,
    subscribedAt: serverTimestamp(),
    source: 'landing_footer',
  };
  await setDoc(ref, data, { merge: true });
}
