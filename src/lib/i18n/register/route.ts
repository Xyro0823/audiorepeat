import { registerNamespaces, type NamespacePartials } from '../dictionaries';
import { coreBundle } from './core';
import { landingBundle } from './landing';
import { dashboardBundle } from './dashboard';
import { libraryBundle } from './library';
import { playerBundle } from './player';
import { challengeBundle } from './challenge';
import { reviewBundle } from './review';
import { statsBundle } from './stats';
import { checkoutBundle } from './checkout';

/**
 * Route → bundle wiring. `registerRoute()` is called at module scope of each
 * route entry (app/<route>/page.tsx), guaranteeing the namespace tables are
 * filled synchronously BEFORE any component renders — and, because the call
 * lives in a real module with its result consumed by the registry, bundlers
 * cannot tree-shake it away (regression: side-effect-only registrar modules
 * were dropped from the production client graph, leaving raw i18n keys).
 *
 * Adding a namespace: create/extend a bundle file, list it under the route(s)
 * that render it, then extend i18n.registry.test.ts sentinels.
 */
const ROUTE_BUNDLES = {
  landing: [landingBundle],
  dashboard: [libraryBundle, dashboardBundle, landingBundle, playerBundle, challengeBundle, statsBundle],
  player: [playerBundle, challengeBundle, statsBundle],
  review: [reviewBundle, dashboardBundle, statsBundle],
  stats: [statsBundle, dashboardBundle],
  checkout: [checkoutBundle, landingBundle],
} satisfies Record<string, NamespacePartials[]>;

export type RouteName = keyof typeof ROUTE_BUNDLES;

/** Register every namespace a route renders. Synchronous; safe to re-call. */
export function registerRoute(route: RouteName): void {
  registerNamespaces(coreBundle);
  for (const bundle of ROUTE_BUNDLES[route]) {
    if (bundle) registerNamespaces(bundle);
  }
}

/** All route bundles — used by tests to assert full key coverage. */
export const ALL_BUNDLES: NamespacePartials[] = [
  coreBundle,
  ...Object.values(ROUTE_BUNDLES).flat(),
];
