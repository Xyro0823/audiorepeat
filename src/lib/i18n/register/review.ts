// Route bundle data: review translations.
import { reviewEn } from '../en/review';
import { reviewMn } from '../mn/review';
import type { NamespacePartials } from '../dictionaries';

export const reviewBundle: NamespacePartials = {
  en: { ...reviewEn },
  mn: { ...reviewMn },
};
