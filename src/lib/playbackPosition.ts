export interface PlaybackPosition {
  wordId: string;
  updatedAt: number;
}

const KEY_PREFIX = 'audiorepeat-playback-position-v1';

export function playbackPositionKey(
  userId: string | null | undefined,
  setId: string,
): string {
  return `${KEY_PREFIX}:${userId ?? 'guest'}:${setId}`;
}

export function readPlaybackPosition(
  userId: string | null | undefined,
  setId: string,
): PlaybackPosition | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(playbackPositionKey(userId, setId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PlaybackPosition>;
    if (
      typeof parsed.wordId !== 'string' ||
      parsed.wordId.length === 0 ||
      typeof parsed.updatedAt !== 'number' ||
      !Number.isFinite(parsed.updatedAt)
    ) return null;
    return { wordId: parsed.wordId, updatedAt: parsed.updatedAt };
  } catch {
    return null;
  }
}

export function savePlaybackPosition(
  userId: string | null | undefined,
  setId: string,
  wordId: string,
): void {
  if (typeof window === 'undefined' || !setId || !wordId) return;
  try {
    window.localStorage.setItem(
      playbackPositionKey(userId, setId),
      JSON.stringify({ wordId, updatedAt: Date.now() } satisfies PlaybackPosition),
    );
  } catch {
    // Storage may be disabled or full; playback should continue normally.
  }
}

export function clearPlaybackPosition(
  userId: string | null | undefined,
  setId: string,
): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(playbackPositionKey(userId, setId));
  } catch {
    // Storage unavailable — nothing else to do.
  }
}
