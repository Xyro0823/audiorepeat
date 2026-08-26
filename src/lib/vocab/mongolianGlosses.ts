import type { WordBankWord } from './wordBanks';

export type MongolianGlossary = ReadonlyMap<string, string>;

function key(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase('en-US')
    .replace(/[?!.,;:()[\]{}]/g, '')
    .replace(/^to\s+/, '')
    .replace(/\s+/g, ' ');
}

/** Build an English-gloss → Mongolian meaning lookup from the shipped mn-A1 pack. */
export function createMongolianGlossary(words: readonly WordBankWord[]): MongolianGlossary {
  const glossary = new Map<string, string>();
  for (const [mongolian, english] of words) {
    const exact = key(english);
    if (exact) glossary.set(exact, mongolian);
    // Banks frequently use alternatives such as "excuse me / sorry". Each
    // independent meaning should still work when it appears in another pack.
    for (const alternative of english.split(/\s*\/\s*/)) {
      const normalized = key(alternative);
      if (normalized) glossary.set(normalized, mongolian);
    }
  }
  return glossary;
}

/**
 * Return the Mongolian equivalent when the installed starter glossary knows
 * it. Undefined is intentional: callers keep the original text and voice
 * rather than reading English through a Mongolian voice.
 */
export function mongolianGlossFor(glossary: MongolianGlossary, english: string): string | undefined {
  const exact = glossary.get(key(english));
  if (exact) return exact;
  for (const alternative of english.split(/\s*\/\s*/)) {
    const match = glossary.get(key(alternative));
    if (match) return match;
  }
  return undefined;
}
