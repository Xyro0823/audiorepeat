// Route bundle data: dashboard translations.
import { dashboardEn } from '../en/dashboard';
import { dashboardMn } from '../mn/dashboard';
import type { NamespacePartials } from '../dictionaries';

export const dashboardBundle: NamespacePartials = {
  en: { ...dashboardEn },
  mn: { ...dashboardMn },
};
