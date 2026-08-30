import { CEFR_LEVELS, type CefrLevel } from '@/types/app';
import { loadWordBank, type WordBankManifest } from '@/lib/vocab/wordBanks';

export interface PlacementQuestion {
  id: string;
  level: CefrLevel;
  /** Word in the language the learner selected. */
  target: string;
  /** Meaning in the learner's interface language. */
  meaning: string;
  options: string[];
  answer: string;
}

const QUESTION_LEVELS: readonly CefrLevel[] = ['A1', 'A1', 'A2', 'A2', 'B1', 'B1', 'B2', 'B2', 'C1', 'C2'];

/** A test is only shown when all six CEFR banks are present for the language. */
export function hasPlacementBank(manifest: WordBankManifest | null, lang: string): boolean {
  return CEFR_LEVELS.every((level) => (manifest?.[lang]?.[level] ?? 0) > 0);
}

function hash(value: string): number {
  let out = 0;
  for (let i = 0; i < value.length; i += 1) out = (out * 31 + value.charCodeAt(i)) >>> 0;
  return out;
}

function rotate<T>(items: readonly T[], start: number): T[] {
  if (items.length === 0) return [];
  const at = start % items.length;
  return [...items.slice(at), ...items.slice(0, at)];
}

/**
 * Creates a stable, language-specific ten-question vocabulary check. The
 * distractors are always drawn from the same real word banks — no generated
 * content and no network service beyond the app's static vocabulary files.
 */
export async function createPlacementQuestions(lang: string, attemptId = ''): Promise<PlacementQuestion[]> {
  const banks = await Promise.all(CEFR_LEVELS.map((level) => loadWordBank(lang, level)));
  if (banks.some((bank) => !bank || bank.words.length < 4)) return [];

  return QUESTION_LEVELS.map((level, index) => {
    const bank = banks[CEFR_LEVELS.indexOf(level)]!;
    const wordIndex = hash(`${lang}:${attemptId}:${level}:${index}`) % bank.words.length;
    const word = bank.words[wordIndex];
    // Word banks are intentionally ordered into small themes (greetings,
    // family, places, food, etc.). Adjacent words therefore make genuinely
    // plausible distractors; choosing random words from the whole bank made a
    // correct answer obvious (e.g. hello beside low / hot / cold).
    const neighbors = [-2, -1, 1, 2, -3, 3]
      .map((offset) => bank.words[(wordIndex + offset + bank.words.length) % bank.words.length]?.[0])
      .filter((target): target is string => Boolean(target) && target !== word[0]);
    const distractors = [...new Set(neighbors)].slice(0, 3);
    const options = rotate([word[0], ...distractors], hash(`${lang}:${attemptId}:order:${index}`) % 4);
    return { id: `${level}-${index}`, level, target: word[0], meaning: word[1], options, answer: word[0] };
  });
}

/** A conservative score-to-CEFR mapping; learners can always override it. */
export function placementLevelForScore(score: number): CefrLevel {
  if (score <= 1) return 'A1';
  if (score <= 3) return 'A2';
  if (score <= 5) return 'B1';
  if (score <= 7) return 'B2';
  if (score <= 9) return 'C1';
  return 'C2';
}
