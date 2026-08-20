/** Previous item with playlist-style wrapping. */
export function previousWordIndex(currentIndex: number, wordCount: number): number {
  if (wordCount <= 0) return 0;
  return (currentIndex - 1 + wordCount) % wordCount;
}

/** Clamp a requested position to a real word in the current playlist. */
export function clampWordIndex(requestedIndex: number, wordCount: number): number {
  if (wordCount <= 0 || !Number.isFinite(requestedIndex)) return 0;
  return Math.min(wordCount - 1, Math.max(0, Math.trunc(requestedIndex)));
}
