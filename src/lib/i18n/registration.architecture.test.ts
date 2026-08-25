import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Architecture guard for route-level i18n registration.
 *
 * The registry is a client-side module; registration must therefore run in
 * BOTH module graphs:
 *  - the route's top-level CLIENT component (client graph → hydration/render)
 *  - the route page entry (server graph → translated SSR HTML)
 *
 * Production regression this prevents: registration existed only in one
 * graph, so one side rendered raw namespace keys. These source contracts
 * fail loudly if either call site disappears.
 */

const CLIENT_ENTRY: Record<string, string> = {
  landing: 'src/components/landing/LandingPage.tsx',
  dashboard: 'src/components/library/SetLibrary.tsx',
  player: 'src/components/player/PlayerView.tsx',
  review: 'src/components/review/ReviewSession.tsx',
  stats: 'src/components/stats/StatsView.tsx',
  checkout: 'src/components/checkout/CheckoutFlow.tsx',
};

const PAGES: Record<string, string[]> = {
  landing: ['src/app/page.tsx'],
  dashboard: ['src/app/dashboard/page.tsx'],
  player: ['src/app/player/page.tsx'],
  review: ['src/app/review/page.tsx'],
  stats: ['src/app/stats/page.tsx'],
  checkout: ['src/app/checkout/page.tsx', 'src/app/checkout/success/page.tsx'],
};

function src(path: string): string {
  return readFileSync(path, 'utf8');
}

describe('route i18n registration architecture', () => {
  for (const [route, file] of Object.entries(CLIENT_ENTRY)) {
    it(`${route}: client entry "${file}" self-registers synchronously`, () => {
      const s = src(file);
      expect(
        /^["']use client["'];?/.test(s.trimStart()),
        'must be a client component',
      ).toBe(true);
      expect(s).toContain(`registerRoute("${route}")`);
    });
  }

  for (const [route, files] of Object.entries(PAGES)) {
    it(`${route}: server page entry registers for translated SSR`, () => {
      for (const file of files) {
        expect(src(file), file).toContain(`registerRoute("${route}")`);
      }
    });
  }
});
