// Route bundle data: library translations.
import { libraryEn } from '../en/library';
import { libraryMn } from '../mn/library';
import type { NamespacePartials } from '../dictionaries';

export const libraryBundle: NamespacePartials = {
  en: { ...libraryEn },
  mn: { ...libraryMn },
};
