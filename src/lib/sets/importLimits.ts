/**
 * Canonical import size limits — shared by every import path:
 *   - JSON file import      (SetLibrary.handleImportFile → parseSetJson*)
 *   - shared `#set=` links  (share.decodeSetFromUrl → parseSetJson)
 *   - subtitle imports      (SubtitleImportModal output, guarded at confirm)
 *   - starter batches       (fixed ≤1000 words, guarded anyway at confirm)
 *
 * Chosen to stay comfortably inside the server-side sync quotas
 * (librarySync.ts: MAX_TOTAL_SYNC_WORDS = 80,000, MAX_SYNC_BODY_BYTES = 5MB):
 * a maximum-size import consumes at most 12.5% of the total word budget and
 * 40% of the request-body budget, so one oversized file can never wedge a
 * user's entire library out of sync.
 */

/** Hard cap on words per imported set. */
export const MAX_IMPORT_WORDS = 10_000;

/** Hard cap on the raw encoded input (JSON text or subtitle file) in bytes. */
export const MAX_IMPORT_BYTES = 2_000_000;

export type ImportSizeRejection = 'too-many-words' | 'too-large';

/** Byte-accurate size check (UTF-8), safe before any parsing work. */
export function importBytesExceed(text: string): boolean {
  return new TextEncoder().encode(text).byteLength > MAX_IMPORT_BYTES;
}

export function importFileBytesExceed(file: { size: number }): boolean {
  return file.size > MAX_IMPORT_BYTES;
}

export function importWordCountExceeds(wordCount: number): boolean {
  return wordCount > MAX_IMPORT_WORDS;
}
