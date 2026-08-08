export interface TTSEngineVoice {
  name: string;
  lang: string; // BCP-47
  localService: boolean; // true => works fully offline
  uri: string;
  isDefault: boolean;
}

export interface SpeakOptions {
  text: string;
  lang: string; // BCP-47
  rate: number;
  /** 0..1; default 1. Engines apply it per utterance (sleep-timer fade). */
  volume?: number;
  voiceURI?: string;
  onStart?: () => void;
  onEnd: () => void;
  onError: (err: unknown) => void;
}

/**
 * Any TTS backend (Web Speech API, cached audio, cloud TTS).
 * The audio loop depends only on this interface, so engines are swappable
 * without touching playback logic — and the hook is unit-testable.
 */
export interface TTSEngine {
  readonly id: string;
  /** Speak one logical unit. Must call onEnd/onError exactly once (unless stopped). */
  speak(opts: SpeakOptions): void;
  /** Cancel whatever is speaking. Callbacks of the cancelled utterance are NOT invoked. */
  stop(): void;
  getVoices(lang?: string): TTSEngineVoice[];
  loadVoices(): Promise<TTSEngineVoice[]>;
}

/** SSR-safe no-op engine — speech never starts on the server. */
export class NoopEngine implements TTSEngine {
  readonly id = 'noop';
  speak(): void {}
  stop(): void {}
  getVoices(): TTSEngineVoice[] {
    return [];
  }
  loadVoices(): Promise<TTSEngineVoice[]> {
    return Promise.resolve([]);
  }
}
