import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Regression guard for the namespace-split registry (see dictionaries.ts).
 *
 * Production bug this file prevents: side-effect-only registrar modules were
 * tree-shaken out of the deployed client graph, so route tables stayed empty
 * and components rendered raw keys ("dashboard.welcome.title", …). The fix
 * routes registration through explicit `registerRoute()` calls; these tests
 * pin the contract:
 *  1. CORE alone must resolve every GLOBAL/layout key (update toast, error
 *     boundary, install prompt) in BOTH locales — on any route.
 *  2. After registerRoute(<route>), that route's sentinel UI keys must be
 *     present in the table for EN and MN (never resolve to the raw key).
 *  3. Registering ALL bundles covers the full data-file key universe.
 */

import {
  getDictionary,
  registerNamespaces,
} from './dictionaries';
import { ALL_BUNDLES } from './register/route';
import type { RouteName } from './register/route';

// Data modules — the authoritative key universe (test-only import).
import { en as commonEn, pwaEn, syncEn, errorsEn } from './en/common';
import { authEn } from './en/auth';
import { settingsEn } from './en/settings';
import { onboardingEn } from './en/onboarding';
import { landingEn } from './en/landing';
import { dashboardEn } from './en/dashboard';
import { libraryEn } from './en/library';
import { playerEn } from './en/player';
import { challengeEn } from './en/challenge';
import { reviewEn } from './en/review';
import { statsEn } from './en/stats';
import { checkoutEn } from './en/checkout';

type StrMap = Record<string, string>;
const DATA_UNIVERSE: StrMap = {
  ...(commonEn as unknown as StrMap),
  ...(pwaEn as unknown as StrMap),
  ...(syncEn as unknown as StrMap),
  ...(errorsEn as unknown as StrMap),
  ...(authEn as unknown as StrMap),
  ...(settingsEn as unknown as StrMap),
  ...(onboardingEn as unknown as StrMap),
  ...(landingEn as unknown as StrMap),
  ...(dashboardEn as unknown as StrMap),
  ...(libraryEn as unknown as StrMap),
  ...(playerEn as unknown as StrMap),
  ...(challengeEn as unknown as StrMap),
  ...(reviewEn as unknown as StrMap),
  ...(statsEn as unknown as StrMap),
  ...(checkoutEn as unknown as StrMap),
};

const ROUTE_SENTINELS: Record<RouteName, string[]> = {
  landing: ['landing.nav.skip', 'landing.nav.home'],
  dashboard: [
    'dashboard.welcome.title',
    'dashboard.metric.accuracy.label',
    'dashboard.checklist.title',
    'dashboard.freeNotice.upgrade',
    'library.typeToSearch',
    'stats.dayStreak',
  ],
  player: ['player.controls.play', 'challenge.finish.newBest', 'stats.dayStreak'],
  review: ['review.showAnswer', 'dashboard.lock.cta'],
  stats: ['stats.empty.backLibrary', 'dashboard.lock.badge'],
  checkout: ['checkout.kicker', 'landing.plan.bullet.standardTts'],
};

/** Keys rendered by root-layout/global surfaces — must live in CORE. */
const GLOBAL_KEYS = [
  'dashboard.update.title',
  'dashboard.update.body',
  'dashboard.update.reload',
  'dashboard.update.dismissAria',
  'dashboard.install.addTitle',
  'dashboard.error.dashboardLink',
  'error.generic.title',
];

async function freshRegistry() {
  vi.resetModules();
  const dicts = await import('./dictionaries');
  const { registerRoute } = await import('./register/route');
  return { registerRoute, getDictionary: dicts.getDictionary };
}

describe('split i18n registry coverage', () => {
  it('resolves global/layout keys from CORE alone, in EN and MN', async () => {
    const { registerRoute, getDictionary } = await freshRegistry();
    registerRoute('landing'); // most minimal route — core + landing only
    for (const lang of ['en', 'mn'] as const) {
      const table = getDictionary(lang);
      for (const key of GLOBAL_KEYS) {
        const value = table[key];
        expect(value, `${lang}:${key}`).toBeDefined();
        expect(value.trim(), `${lang}:${key}`).not.toBe('');
        expect(value.startsWith(key), `${lang}:${key}`).toBe(false);
      }
    }
  });

  for (const route of Object.keys(ROUTE_SENTINELS) as RouteName[]) {
    it(`registers all sentinel keys for /${route} synchronously`, async () => {
      const { registerRoute, getDictionary } = await freshRegistry();
      registerRoute(route);
      for (const lang of ['en', 'mn'] as const) {
        const table = getDictionary(lang);
        for (const key of ROUTE_SENTINELS[route]) {
          expect(table[key], `${lang}:${route}:${key}`).toBeDefined();
          expect(table[key].trim(), `${lang}:${route}:${key}`).not.toBe('');
        }
      }
    });
  }

  it('translate() never returns a raw namespaced sentinel key', async () => {
    const { registerRoute } = await freshRegistry();
    const { translate } = await import('./index');
    for (const route of Object.keys(ROUTE_SENTINELS) as RouteName[]) {
      registerRoute(route);
      for (const key of ROUTE_SENTINELS[route]) {
        expect(translate('en', key as never), `en:${key}`).not.toBe(key);
        expect(translate('mn', key as never), `mn:${key}`).not.toBe(key);
      }
    }
  });

  it('covers the full data-file key universe when ALL bundles are registered', () => {
    for (const bundle of ALL_BUNDLES) {
      if (bundle) registerNamespaces(bundle);
    }
    const enTable = getDictionary('en');
    for (const key of Object.keys(DATA_UNIVERSE)) {
      expect(enTable[key], key).toBeDefined();
    }
  });
});

beforeEach(() => {
  vi.resetModules();
});
