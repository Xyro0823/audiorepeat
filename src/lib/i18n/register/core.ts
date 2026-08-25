import type { NamespacePartials } from '../dictionaries';
import { en as commonEnAll } from '../en/common';
import { mn as commonMnAll } from '../mn/common';
import { authEn } from '../en/auth';
import { authMn } from '../mn/auth';
import { settingsEn } from '../en/settings';
import { settingsMn } from '../mn/settings';
import { onboardingEn } from '../en/onboarding';
import { onboardingMn } from '../mn/onboarding';

/**
 * CORE bundle - registered by the i18n entry itself, so every route and every
 * global/layout surface (error boundary, PWA install + update prompts, auth,
 * settings modal, onboarding bars) can translate regardless of route.
 */
export const coreBundle: NamespacePartials = {
  en: { ...commonEnAll, ...authEn, ...settingsEn, ...onboardingEn },
  mn: { ...commonMnAll, ...authMn, ...settingsMn, ...onboardingMn },
};