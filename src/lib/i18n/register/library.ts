// Route bundle: library translations.
import { libraryEn } from '../en/library';
import { libraryMn } from '../mn/library';

import { registerNamespaces } from '../dictionaries';

registerNamespaces({
  en: { ...libraryEn },
  mn: { ...libraryMn },
});

