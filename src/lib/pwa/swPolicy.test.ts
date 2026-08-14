import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Static configuration tests for the hand-written service worker
 * (public/sw.js). The SW is plain JS with no framework, so these assert the
 * actual hardening rules in the shipped artifact: the network-only guard for
 * privileged surfaces, its ordering ahead of every caching branch, and that
 * normal offline functionality remains untouched.
 */
const sw = readFileSync(join(process.cwd(), 'public', 'sw.js'), 'utf8');

describe('PWA service worker — admin surfaces are never cached', () => {
  it('defines a network-only guard covering /admin and /api/admin', () => {
    expect(sw).toContain('function isNetworkOnly(url)');
    expect(sw).toMatch(/url\.pathname\.startsWith\("\/admin\/"\)/);
    expect(sw).toMatch(/url\.pathname\.startsWith\("\/api\/admin\/"\)/);
    // Exact-path matches too (no trailing slash).
    expect(sw).toMatch(/url\.pathname === "\/admin"/);
    expect(sw).toMatch(/url\.pathname === "\/api\/admin"/);
  });

  it('runs the guard before any caching branch in the fetch handler', () => {
    const fetchIndex = sw.indexOf('self.addEventListener("fetch"');
    expect(fetchIndex).toBeGreaterThan(-1);
    const guardUse = sw.indexOf('isNetworkOnly(url)', fetchIndex);
    const branches = [
      '"/audio/"',
      '"/_next/static/"',
      '"/data/"',
      'request.mode === "navigate"',
    ];
    expect(guardUse).toBeGreaterThan(fetchIndex);
    for (const branch of branches) {
      const branchIndex = sw.indexOf(branch, fetchIndex);
      expect(branchIndex).toBeGreaterThan(-1);
      expect(guardUse).toBeLessThan(branchIndex);
    }
  });

  it('never precaches admin pages in the app-shell list', () => {
    // Between the SHELL array brackets there must be no /admin path.
    const shellMatch = sw.match(/const SHELL = \[([\s\S]*?)\];/);
    expect(shellMatch).not.toBeNull();
    expect(shellMatch![1]).not.toMatch(/\/admin/);
  });

  it('excludes network-only URLs from the PRECACHE message handler', () => {
    const precacheIndex = sw.indexOf('data.type === "PRECACHE"');
    expect(precacheIndex).toBeGreaterThan(-1);
    const filterSection = sw.slice(precacheIndex, precacheIndex + 1200);
    expect(filterSection).toContain('isNetworkOnly(url)');
  });

  it('never serves the offline shell fallback for admin navigations', () => {
    // The network-only guard must be evaluated before the navigation fallback,
    // and the fallback itself must not reference admin paths.
    const navIndex = sw.indexOf('request.mode === "navigate"');
    const guardIndex = sw.indexOf('isNetworkOnly(url)');
    expect(guardIndex).toBeLessThan(navIndex);
    const fallbackSection = sw.slice(navIndex, sw.indexOf('});', navIndex));
    expect(fallbackSection).not.toMatch(/admin/);
  });

  it('keeps normal safe PWA routes unaffected', () => {
    // Regular offline functionality is still served by the worker.
    expect(sw).toContain('"/audio/"');
    expect(sw).toContain('"/_next/static/"');
    expect(sw).toContain('"/data/"');
    expect(sw).toContain('caches.match("/")');
    expect(sw).toContain('cache.addAll(SHELL)');
  });

  it('does not cache any /api/ responses (including /api/entitlement)', () => {
    // The worker only intercepts /audio/, /_next/static/, /data/ and
    // navigations — no /api/ prefix is cached anywhere.
    expect(sw).not.toMatch(/pathname\.startsWith\("\/api\/"\)/);
  });
});

describe('PWA service worker — payment surfaces are never cached', () => {
  it('covers checkout pages and payment endpoints in the network-only guard', () => {
    expect(sw).toContain('url.pathname === "/checkout"');
    expect(sw).toContain('url.pathname.startsWith("/checkout/")');
    expect(sw).toContain('url.pathname === "/api/checkout"');
    expect(sw).toContain('url.pathname === "/api/paddle/webhook"');
    expect(sw).toContain('url.pathname === "/api/stripe/webhook"');
  });

  it('never precaches checkout pages in the app-shell list', () => {
    const shellMatch = sw.match(/const SHELL = \[([\s\S]*?)\];/);
    expect(shellMatch).not.toBeNull();
    expect(shellMatch![1]).not.toMatch(/\/checkout/);
  });

  it('never serves the offline shell fallback for checkout navigations', () => {
    const navIndex = sw.indexOf('request.mode === "navigate"');
    expect(navIndex).toBeGreaterThan(-1);
    const fallbackSection = sw.slice(navIndex, sw.indexOf('});', navIndex));
    expect(fallbackSection).not.toMatch(/checkout/);
  });
});
