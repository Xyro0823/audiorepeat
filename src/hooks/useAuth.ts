'use client';

import { useEffect, useSyncExternalStore } from 'react';
import {
  authMode,
  continueAsGuest,
  deleteAccount,
  getAuthSnapshot,
  hydrateAuth,
  login,
  checkEmailVerification,
  resetPassword,
  resendVerificationEmail,
  logout,
  signInWithGoogle,
  signup,
  subscribeAuth,
} from '@/lib/authStore';

/**
 * React binding for the auth store. Hydration is triggered lazily by the
 * first consumer (the layout-level AuthGate) and is idempotent.
 */
export function useAuth() {
  const state = useSyncExternalStore(subscribeAuth, getAuthSnapshot, getAuthSnapshot);

  useEffect(() => {
    void hydrateAuth();
  }, []);

  // The store functions already have the exact signatures — return them
  // directly so their identity is stable across renders.
  return {
    ...state,
    mode: authMode(),
    signup,
    login,
    checkEmailVerification,
    resetPassword,
    resendVerificationEmail,
    signInWithGoogle,
    logout,
    continueAsGuest,
    deleteAccount,
  };
}
