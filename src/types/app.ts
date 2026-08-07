import type { LoopSettings } from './loop';

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
  createdAt: number;
  updatedAt: number;
}

export interface AppSettings extends LoopSettings {
  cachedAudio: boolean; // prefer pre-generated cached audio (offline) when available
}

export const DEFAULT_SETTINGS: AppSettings = {
  repeats: 2,
  speed: 1,
  targetGapMs: 600,
  translationGapMs: 900,
  loop: true,
  cachedAudio: false,
};
