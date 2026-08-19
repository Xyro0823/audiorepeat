import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  updateSettings: vi.fn(), listener: null as ((user: unknown) => void) | null,
  getFirebaseIdToken: vi.fn(),
}));

vi.mock('@/lib/firebase/config', () => ({ getAuthMode: () => 'firebase' }));
vi.mock('@/lib/onboarding', () => ({ isNewlyCreatedAccount: () => false, markOnboardingPending: vi.fn() }));
vi.mock('@/lib/settingsStore', () => ({ updateSettings: h.updateSettings }));
vi.mock('@/lib/firebase/client', () => ({
  getFirebaseAuth: () => ({ signOut: vi.fn(), currentUser: null }),
  onFirebaseAuthChange: (_auth: unknown, listener: (user: unknown) => void) => { h.listener = listener; },
  firebaseUserToAuthUser: (user: { uid: string }) => ({
    id: user.uid, username: user.uid, createdAt: 1, lastLoginAt: 1,
  }),
  getFirebaseIdToken: h.getFirebaseIdToken,
  describeFirebaseError: () => 'auth failed',
}));

import { continueAsGuest, getAuthSnapshot, hydrateAuth, logout } from './authStore';

beforeEach(() => {
  h.updateSettings.mockClear();
  h.getFirebaseIdToken.mockReset();
  h.getFirebaseIdToken.mockResolvedValue('token');
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 503 })));
});

describe('auth entitlement isolation', () => {
  it('fails closed before a signed-in entitlement lookup and on session loss', async () => {
    await hydrateAuth();
    h.updateSettings.mockClear();
    h.listener?.({ uid: 'user-a' });
    expect(getAuthSnapshot()).toMatchObject({ status: 'signed-in', user: { id: 'user-a' } });
    expect(h.updateSettings).toHaveBeenLastCalledWith({ plan: 'basic', planBilling: 'annual', planSource: null });
    await Promise.resolve();
    h.listener?.(null);
    expect(getAuthSnapshot().status).toBe('guest');
    expect(h.updateSettings).toHaveBeenLastCalledWith({ plan: 'basic', planBilling: 'annual', planSource: null });
  });

  it('resets the complete entitlement synchronously on logout and guest continuation', () => {
    logout();
    expect(h.updateSettings).toHaveBeenLastCalledWith({ plan: 'basic', planBilling: 'annual', planSource: null });
    continueAsGuest();
    expect(h.updateSettings).toHaveBeenLastCalledWith({ plan: 'basic', planBilling: 'annual', planSource: null });
  });
});
