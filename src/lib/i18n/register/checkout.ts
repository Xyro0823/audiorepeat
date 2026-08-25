// Route bundle data: checkout translations.
import { checkoutEn } from '../en/checkout';
import { checkoutMn } from '../mn/checkout';
import type { NamespacePartials } from '../dictionaries';

export const checkoutBundle: NamespacePartials = {
  en: { ...checkoutEn },
  mn: { ...checkoutMn },
};
