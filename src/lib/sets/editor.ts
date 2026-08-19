import type { VocabWord } from '@/types/app';

/** Normalize editor rows and discard incomplete/subtitle-placeholder rows. */
export function cleanEditorWords(words: VocabWord[]): VocabWord[] {
  return words
    .filter((word) => {
      const target = word.target.trim();
      const translation = word.translation.trim();
      return target.length > 0 && translation.length > 0 && translation !== '—';
    })
    .map((word) => ({
      ...word,
      target: word.target.trim(),
      translation: word.translation.trim(),
      example: word.example?.trim() || undefined,
    }));
}
