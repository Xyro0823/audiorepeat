import type { LoopSettings } from './loop';

export const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;
export type CefrLevel = (typeof CEFR_LEVELS)[number];

export interface VocabWord {
  id: string;
  target: string;
  translation: string;
  repeats?: number; // per-word override; falls back to settings.repeats
}

export interface VocabSet {
  id: string;
  name: string;
  lang: string; // BCP-47 target language, e.g. "es-ES"
  nativeLang: string; // BCP-47 for translations, e.g. "en-US"
  words: VocabWord[];
  /** Per-set overrides, merged over the global AppSettings. */
  settings?: Partial<AppSettings>;
  /** Optional CEFR difficulty level (A1-C2), e.g. for starter-library sets. */
  cefr?: CefrLevel;
  createdAt: number;
  updatedAt: number;
}

export interface AppSettings extends LoopSettings {
  cachedAudio: boolean; // prefer pre-generated cached audio (offline) when available
}

export const DEFAULT_SETTINGS: AppSettings = {
  repeats: 2,
  speed: 1,
  targetGapMs: 1000,
  translationGapMs: 900,
  loop: true,
  cachedAudio: false,
};
