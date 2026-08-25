// Route bundle: stats translations.
import { statsEn } from '../en/stats';
import { statsMn } from '../mn/stats';

import { registerNamespaces } from '../dictionaries';

registerNamespaces({
  en: { ...statsEn },
  mn: { ...statsMn },
});

