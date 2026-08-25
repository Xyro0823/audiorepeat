// Route bundle: dashboard translations.
import { dashboardEn } from '../en/dashboard';
import { dashboardMn } from '../mn/dashboard';

import { registerNamespaces } from '../dictionaries';

registerNamespaces({
  en: { ...dashboardEn },
  mn: { ...dashboardMn },
});

