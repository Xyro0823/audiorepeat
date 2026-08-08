/**
 * Per-account localStorage keys. Stats, streak, display name and challenge
 * records are scoped by account id, so each account on this device keeps its
 * own history. The guest scope (no id) keeps the original key names, so
 * existing guest data is preserved exactly as before accounts existed.
 */
export function statsStorageKey(userId: string | null | undefined): string {
  return userId ? `audiorepeat-stats-v1:${userId}` : 'audiorepeat-stats-v1';
}

export function usernameStorageKey(userId: string | null | undefined): string {
  return userId ? `audiorepeat-username:${userId}` : 'audiorepeat-username';
}

export function bestScoreStorageKey(userId: string | null | undefined, setId: string): string {
  return userId
    ? `audiorepeat-challenge-best-v1:${userId}:${setId}`
    : `audiorepeat-challenge-best-v1:${setId}`;
}
