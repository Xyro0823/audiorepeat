import { describe, expect, it } from 'vitest';
import {
  ADMIN_DASHBOARD_ROUTE,
  landingAuthAction,
  resolveAdminStatus,
} from '@/lib/adminNav';

describe('resolveAdminStatus', () => {
  it('shows admin UI only on an explicit 200/admin verdict', () => {
    expect(resolveAdminStatus('admin')).toBe('admin');
  });

  it('fails closed on every non-admin verdict (no admin-link flash)', () => {
    // 403 — valid token, not on the allowlist
    expect(resolveAdminStatus('forbidden')).toBe('not-admin');
    // 503 — admin layer not configured / service unavailable
    expect(resolveAdminStatus('server-error')).toBe('not-admin');
    // missing/rejected token
    expect(resolveAdminStatus('no-token')).toBe('not-admin');
  });
});

describe('landingAuthAction', () => {
  it('shows no auth action while loading (no flash, no layout surprise)', () => {
    expect(landingAuthAction('loading')).toBeNull();
  });

  it('shows Sign in for signed-out and guest users', () => {
    expect(landingAuthAction('signed-out')).toEqual({ kind: 'auth', label: 'Sign in' });
    expect(landingAuthAction('guest')).toEqual({ kind: 'auth', label: 'Sign in' });
  });

  it('replaces Sign in with a Dashboard link for signed-in users', () => {
    expect(landingAuthAction('signed-in')).toEqual({
      kind: 'link',
      label: 'Dashboard',
      href: '/dashboard',
    });
  });
});

describe('ADMIN_DASHBOARD_ROUTE', () => {
  it('points to the canonical normal-app dashboard route', () => {
    expect(ADMIN_DASHBOARD_ROUTE).toBe('/dashboard');
  });

  it('matches the signed-in landing action so admin back-nav never drifts', () => {
    // The admin pages' "← Dashboard" exit must go to the same canonical route
    // the rest of the app uses for the signed-in dashboard.
    const action = landingAuthAction('signed-in');
    expect(action && action.kind === 'link' ? action.href : null).toBe(ADMIN_DASHBOARD_ROUTE);
  });
});
