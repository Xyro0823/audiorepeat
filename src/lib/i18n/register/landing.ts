// Route bundle: landing translations.
import { landingEn } from '../en/landing';
import { landingMn } from '../mn/landing';

import { registerNamespaces } from '../dictionaries';

registerNamespaces({
  en: { ...landingEn },
  mn: { ...landingMn },
});

