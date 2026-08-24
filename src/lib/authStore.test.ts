import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  updateSettings: vi.fn(), listener: null as ((user: unknown) => void) | null,
  getFirebaseIdToken: vi.fn(),
  calls: [] as string[],
}));

vi.mock('@/lib/firebase/config', () => ({ getAuthMode: () => 'firebase' }));
vi.mock('@/lib/onboarding', () => ({ isNewlyCreatedAccount: () => false, markOnboardingPending: vi.fn() }));
vi.mock('@/lib/db/indexedDb', () => ({
  activateSetOwner: (uid: string | null) => {
    h.calls.push(`sets:${uid ?? 'null'}`);
  },
  migrateLegacySettingsToOwner: vi.fn(async () => false),
}));
vi.mock('@/lib/settingsStore', () => ({
  updateSettings: h.updateSettings,
  activateSettingsOwner: (uid: string | null) => {
    h.calls.push(`settings-owner:${uid ?? 'null'}`);
  },
  hydrateSettings: vi.fn(async () => {}),
}));
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

describe('settings owner activation on auth transitions', () => {
  /** Drain pending async chains from prior tests, then start a clean slate. */
  async function cleanSlate(): Promise<void> {
    await new Promise((r) => setTimeout(r, 5));
    h.calls.length = 0;
    h.updateSettings.mockClear();
    h.updateSettings.mockImplementation((patch: Record<string, unknown>) => {
      h.calls.push(`write:${JSON.stringify(patch)}`);
    });
  }

  it('activates the settings owner BEFORE any entitlement write, for the right scope', async () => {
    await hydrateAuth();
    await cleanSlate();
    // Sign in as User A.
    h.listener?.({ uid: 'user-a' });
    const signInOrder = h.calls.filter((c) => !c.startsWith('write:')).join('|');
    expect(signInOrder).toContain('sets:user-a');
    expect(signInOrder).toContain('settings-owner:user-a');
    // The first entitlement write must happen after both activations target
    // user-a — a reset landing in the previous (guest) scope would corrupt it.
    const lastActivation = Math.max(
      h.calls.indexOf('sets:user-a'),
      h.calls.indexOf('settings-owner:user-a'),
    );
    const firstWrite = h.calls.findIndex((c) => c.startsWith('write:'));
    expect(firstWrite).toBeGreaterThan(lastActivation);
  });

  it('re-points the settings store at the guest scope on logout', async () => {
    await cleanSlate();
    logout();
    const order = h.calls.join('|');
    const activationIndex = order.indexOf('settings-owner:null');
    const writeIndex = order.indexOf(
      `write:${JSON.stringify({ plan: 'basic', planBilling: 'annual', planSource: null })}`,
    );
    expect(activationIndex).toBeGreaterThan(-1);
    expect(writeIndex).toBeGreaterThan(activationIndex);
  });
});
