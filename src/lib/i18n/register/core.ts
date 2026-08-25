import { registerNamespaces } from '../dictionaries';
import { en as commonEnAll } from '../en/common';
import { mn as commonMnAll } from '../mn/common';
import { authEn } from '../en/auth';
import { authMn } from '../mn/auth';
import { settingsEn } from '../en/settings';
import { settingsMn } from '../mn/settings';
import { onboardingEn } from '../en/onboarding';
import { onboardingMn } from '../mn/onboarding';

/**
 * CORE bundle — registered by the i18n entry itself, so every route (and any
 * non-React caller of `t()`) always has the cross-cutting namespaces:
 * shared UI verbs, auth/profile surfaces, the settings modal, and the
 * onboarding/free-language flows that can appear on any page.
 */
registerNamespaces({
  en: { ...commonEnAll, ...authEn, ...settingsEn, ...onboardingEn },
  mn: { ...commonMnAll, ...authMn, ...settingsMn, ...onboardingMn },
});
