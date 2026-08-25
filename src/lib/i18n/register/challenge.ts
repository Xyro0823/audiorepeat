// Route bundle: challenge translations.
import { challengeEn } from '../en/challenge';
import { challengeMn } from '../mn/challenge';

import { registerNamespaces } from '../dictionaries';

registerNamespaces({
  en: { ...challengeEn },
  mn: { ...challengeMn },
});
