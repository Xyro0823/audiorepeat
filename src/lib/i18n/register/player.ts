// Route bundle data: player + challenge translations.
import { playerEn } from '../en/player';
import { playerMn } from '../mn/player';
import { challengeEn } from '../en/challenge';
import { challengeMn } from '../mn/challenge';
import type { NamespacePartials } from '../dictionaries';

export const playerBundle: NamespacePartials = {
  en: { ...playerEn, ...challengeEn },
  mn: { ...playerMn, ...challengeMn },
};
