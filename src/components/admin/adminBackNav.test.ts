import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ADMIN_DASHBOARD_ROUTE } from '@/lib/adminNav';

/**
 * Static tests for the admin "← Dashboard" exit control. The admin pages are
 * client components with auth/authorization flows, so instead of a DOM
 * harness (the repo has none for components) these assert the shipped
 * sources: every admin page renders the shared AdminBackNav, and that
 * component targets the canonical normal-app dashboard route — the same
 * route the landing navbar's Dashboard action uses (see lib/adminNav.test.ts
 * for the route-constant contract).
 */
const read = (file: string) => readFileSync(join(process.cwd(), 'src', 'components', 'admin', file), 'utf8');

const backNav = read('AdminBackNav.tsx');
const entitlements = read('AdminEntitlements.tsx');
const diagnostics = read('AdminDiagnostics.tsx');

describe('admin back navigation', () => {
  it('AdminBackNav links to the canonical dashboard route', () => {
    expect(backNav).toContain(`import { ADMIN_DASHBOARD_ROUTE } from '@/lib/adminNav'`);
    expect(backNav).toMatch(/href=\{ADMIN_DASHBOARD_ROUTE\}/);
    expect(backNav).toContain('Dashboard');
  });

  it('the canonical route is the normal signed-in app dashboard', () => {
    expect(ADMIN_DASHBOARD_ROUTE).toBe('/dashboard');
  });

  it('renders the Dashboard exit control on /admin/entitlements', () => {
    expect(entitlements).toContain(`import AdminBackNav from '@/components/admin/AdminBackNav'`);
    expect(entitlements).toContain('<AdminBackNav />');
  });

  it('renders the Dashboard exit control on /admin/diagnostics', () => {
    expect(diagnostics).toContain(`import AdminBackNav from '@/components/admin/AdminBackNav'`);
    expect(diagnostics).toContain('<AdminBackNav />');
  });

  it('never adds a sign-out action to the admin pages (ProfileDropdown owns sign-out)', () => {
    for (const src of [entitlements, diagnostics]) {
      expect(src).not.toMatch(/\blogout\b/);
      expect(src).not.toMatch(/Sign out/);
    }
  });
});
