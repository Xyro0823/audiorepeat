import type { MasteryStatus } from './app';

export interface LoopWord {
  id: string;
  target: string;
  translation: string;
  lang: string;
  nativeLang?: string;
  repeats?: number;
  mastery?: MasteryStatus;
}

export interface LoopSettings {
  repeats: number;
  speed: number;
  targetGapMs: number;
  translationGapMs: number;
  loop: boolean;
  targetVoiceURI?: string;
  translationVoiceURI?: string;
}

export type PlaybackStatus = 'idle' | 'playing' | 'paused';

export interface LoopProgress {
  wordIndex: number;
  repeatIndex: number;
  isTranslation: boolean;
}
