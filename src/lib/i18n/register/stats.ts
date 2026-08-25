// Route bundle data: stats translations.
import { statsEn } from '../en/stats';
import { statsMn } from '../mn/stats';
import type { NamespacePartials } from '../dictionaries';

export const statsBundle: NamespacePartials = {
  en: { ...statsEn },
  mn: { ...statsMn },
};
