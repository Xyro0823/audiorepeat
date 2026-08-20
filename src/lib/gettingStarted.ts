export interface GettingStartedState {
  languageReady: boolean;
  setReady: boolean;
  practiceReady: boolean;
  installed: boolean;
}

export function gettingStartedDismissKey(userId?: string | null): string {
  return `audiorepeat:getting-started:dismissed:${userId ?? 'guest'}`;
}

export function gettingStartedProgress(state: GettingStartedState): number {
  return Object.values(state).filter(Boolean).length;
}

