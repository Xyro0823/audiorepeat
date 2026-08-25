import type { UiLang } from './types';

/**
 * Namespace-split translation registry.
 *
 * The full EN+MN dictionary graph (~178KB of source across 12 namespaces × 2
 * locales) is no longer eagerly imported by every route. Instead:
 *  - `TKey` remains the COMPLETE English key universe via type-only imports
 *    (zero runtime cost; compile-time coverage unchanged).
 *  - Runtime tables start EMPTY per locale; `registerNamespaces()` fills them
 *    from thin per-bundle registrar modules (`register/*`) that route entries
 *    import statically — so registration happens synchronously before first
 *    render and `t()` stays synchronous (no hydration regressions, no flash).
 *  - `translate()` falls back EN → raw key exactly as before; a missing
 *    namespace degrades to readable keys instead of crashing.
 *
 * Coverage invariant: importing every registrar must satisfy every TKey for
 * BOTH locales — enforced by i18n.registry.test.ts against the data modules.
 */

import type { en as commonEnAll } from './en/common';
import type { dashboardEn } from './en/dashboard';
import type { landingEn } from './en/landing';
import type { libraryEn } from './en/library';
import type { challengeEn } from './en/challenge';
import type { playerEn } from './en/player';
import type { reviewEn } from './en/review';
import type { statsEn } from './en/stats';
import type { settingsEn } from './en/settings';
import type { authEn } from './en/auth';
import type { onboardingEn } from './en/onboarding';
import type { checkoutEn } from './en/checkout';

type FullEn = typeof commonEnAll &
  typeof dashboardEn &
  typeof landingEn &
  typeof libraryEn &
  typeof challengeEn &
  typeof playerEn &
  typeof reviewEn &
  typeof statsEn &
  typeof settingsEn &
  typeof authEn &
  typeof onboardingEn &
  typeof checkoutEn;

/** The complete English key universe — compile-checked for every locale. */
export type TKey = keyof FullEn;
export type Dict = Record<TKey, string>;

const tables: Record<UiLang, Record<string, string>> = { en: {}, mn: {} };

export interface NamespacePartials {
  en?: Record<string, string>;
  mn?: Record<string, string>;
}

/**
 * Merge namespace dictionaries into the live locale tables. Idempotent per
 * namespace (later registrations win keys) and synchronous — call sites are
 * static imports evaluated once at module init.
 */
export function registerNamespaces(partials: NamespacePartials): void {
  if (partials.en) Object.assign(tables.en, partials.en);
  if (partials.mn) Object.assign(tables.mn, partials.mn);
}

/**
 * Live table for a locale. Returns the internal record directly — lookups
 * stay O(1) with no copy, and later registrations are visible immediately.
 */
export function getDictionary(lang: UiLang): Record<string, string> {
  return tables[lang];
}
