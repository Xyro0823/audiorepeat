import { describe, expect, it } from 'vitest';
import { isPublicPath, PUBLIC_PATHS } from '@/lib/publicRoutes';

describe('public routes — Paddle website review', () => {
  it('exposes the landing page plus all three legal pages without auth', () => {
    expect(PUBLIC_PATHS).toContain('/');
    expect(PUBLIC_PATHS).toContain('/privacy');
    expect(PUBLIC_PATHS).toContain('/terms');
    expect(PUBLIC_PATHS).toContain('/refunds');
  });

  it('keeps the app and admin shell behind auth', () => {
    for (const path of [
      '/dashboard',
      '/player',
      '/checkout',
      '/stats',
      '/admin/entitlements',
      '/admin/diagnostics',
      '/admin/analytics',
    ]) {
      expect(isPublicPath(path)).toBe(false);
    }
  });
});
