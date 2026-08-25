// Route bundle: player + challenge translations.
import { playerEn } from '../en/player';
import { playerMn } from '../mn/player';
import { challengeEn } from '../en/challenge';
import { challengeMn } from '../mn/challenge';

import { registerNamespaces } from '../dictionaries';

registerNamespaces({
  en: { ...playerEn, ...challengeEn },
  mn: { ...playerMn, ...challengeMn },
});

