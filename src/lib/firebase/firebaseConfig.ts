/**
 * Your Firebase web app configuration.
 *
 * Two ways to provide it (pick one):
 *
 * 1. Env vars (recommended): copy `.env.example` to `.env.local` and fill in
 *    the values from Firebase console → Project settings → Your apps →
 *    SDK setup and configuration ("firebaseConfig" snippet). Restart the dev
 *    server afterwards.
 *
 * 2. Direct file: paste your `firebaseConfig` object below instead of the
 *    env reads (values are never secret — they're public client config).
 *
 * Until a valid config is present the app shows a setup screen instead of the
 * login form (no fake/device accounts).
 */
export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? '',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? '',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? '',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? '',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? '',
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID ?? '',
};
