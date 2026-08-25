import type { UiLang } from './types';
import { commonEn, en as commonEnAll } from './en/common';
import { mn as commonMnAll } from './mn/common';
import { dashboardEn } from './en/dashboard';
import { dashboardMn } from './mn/dashboard';
import { landingEn } from './en/landing';
import { libraryEn } from './en/library';
import { libraryMn } from './mn/library';
import { landingMn } from './mn/landing';
import { challengeEn } from './en/challenge';
import { playerEn } from './en/player';
import { challengeMn } from './mn/challenge';
import { playerMn } from './mn/player';
import { reviewEn } from './en/review';
import { reviewMn } from './mn/review';
import { statsEn } from './en/stats';
import { statsMn } from './mn/stats';
import { settingsEn } from './en/settings';
import { settingsMn } from './mn/settings';
import { authEn } from './en/auth';
import { authMn } from './mn/auth';
import { onboardingEn } from './en/onboarding';
import { onboardingMn } from './mn/onboarding';
import { checkoutEn } from './en/checkout';
import { checkoutMn } from './mn/checkout';

/**
 * Aggregated dictionaries. The English table defines the key universe;
 * every other locale is compile-checked against it (`Dict` below), so a
 * missing or extra translated key fails `tsc` instead of shipping a gap.
 */
const en = {
  ...commonEnAll,
  ...dashboardEn,
  ...landingEn,
  ...libraryEn,
  ...challengeEn,
  ...playerEn,
  ...reviewEn,
  ...statsEn,
  ...settingsEn,
  ...authEn,
  ...onboardingEn,
  ...checkoutEn,
};

const mn: Dict = {
  ...commonMnAll,
  ...dashboardMn,
  ...landingMn,
  ...libraryMn,
  ...challengeMn,
  ...playerMn,
  ...reviewMn,
  ...statsMn,
  ...settingsMn,
  ...authMn,
  ...onboardingMn,
  ...checkoutMn,
};

export type TKey = keyof typeof en;
type Dict = Record<TKey, string>;

export const dictionaries: Record<UiLang, Record<TKey, string>> = { en, mn };
export { commonEn };
