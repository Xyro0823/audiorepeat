import { applyMasteryStatus } from '@/lib/review/fsrs';
import type { MasteryStatus, VocabWord } from '@/types/app';

export type BulkWordProgress = MasteryStatus | 'reset';

/**
 * Update only the selected words while preserving every in-editor field.
 * Passing `now` keeps FSRS schedule generation deterministic in tests.
 */
export function applyBulkWordProgress(
  words: VocabWord[],
  selectedIds: ReadonlySet<string>,
  progress: BulkWordProgress,
  now = new Date(),
): VocabWord[] {
  if (selectedIds.size === 0) return words;

  const status = progress === 'reset' ? undefined : progress;
  return words.map((word) => (
    selectedIds.has(word.id) ? applyMasteryStatus(word, status, now) : word
  ));
}

/** Remove only the requested rows from the current unsaved editor draft. */
export function deleteSelectedWords(
  words: VocabWord[],
  selectedIds: ReadonlySet<string>,
): VocabWord[] {
  if (selectedIds.size === 0) return words;
  return words.filter((word) => !selectedIds.has(word.id));
}
