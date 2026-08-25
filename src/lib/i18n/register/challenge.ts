// Route bundle data: challenge translations.
import { challengeEn } from '../en/challenge';
import { challengeMn } from '../mn/challenge';
import type { NamespacePartials } from '../dictionaries';

export const challengeBundle: NamespacePartials = {
  en: { ...challengeEn },
  mn: { ...challengeMn },
};
