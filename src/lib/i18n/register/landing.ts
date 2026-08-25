// Route bundle data: landing translations.
import { landingEn } from '../en/landing';
import { landingMn } from '../mn/landing';
import type { NamespacePartials } from '../dictionaries';

export const landingBundle: NamespacePartials = {
  en: { ...landingEn },
  mn: { ...landingMn },
};
