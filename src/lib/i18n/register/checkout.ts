// Route bundle: checkout translations.
import { checkoutEn } from '../en/checkout';
import { checkoutMn } from '../mn/checkout';

import { registerNamespaces } from '../dictionaries';

registerNamespaces({
  en: { ...checkoutEn },
  mn: { ...checkoutMn },
});

