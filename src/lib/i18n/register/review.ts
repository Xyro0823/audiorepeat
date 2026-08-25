// Route bundle: review translations.
import { reviewEn } from '../en/review';
import { reviewMn } from '../mn/review';

import { registerNamespaces } from '../dictionaries';

registerNamespaces({
  en: { ...reviewEn },
  mn: { ...reviewMn },
});

