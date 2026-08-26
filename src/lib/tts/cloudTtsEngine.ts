import type { SpeakOptions, TTSEngine, TTSEngineVoice } from './engine';
import { fetchCloudAudioBlob } from './cloudTts';

/** On-demand cloud speech with device speech as a fail-safe fallback. */
export class CloudTtsEngine implements TTSEngine {
  readonly id = 'cloud-tts';
  private fallback: TTSEngine;
  private audio: HTMLAudioElement | null = null;
  private objectUrl: string | null = null;
  private controller: AbortController | null = null;
  private generation = 0;

  constructor(
    fallback: TTSEngine,
    private readonly canUseCloudForLanguage: (lang: string) => boolean = () => true,
    /** Ignore a stale device-voice preference for this narrowly scoped fallback. */
    private readonly forceCloudForLanguage: (lang: string) => boolean = () => false,
    private readonly onCloudAudioState?: (state: 'saving' | 'cached') => void,
  ) {
    this.fallback = fallback;
  }

  getVoices(lang?: string): TTSEngineVoice[] {
    return this.fallback.getVoices(lang);
  }

  loadVoices(): Promise<TTSEngineVoice[]> {
    return this.fallback.loadVoices();
  }

  speak(opts: SpeakOptions): void {
    // An explicit device voice selection must remain authoritative.
    if (
      !this.canUseCloudForLanguage(opts.lang) ||
      (opts.voiceURI && !this.forceCloudForLanguage(opts.lang))
    ) {
      this.fallback.speak(opts);
      return;
    }
    const gen = ++this.generation;
    this.controller?.abort();
    const controller = new AbortController();
    this.controller = controller;
    this.onCloudAudioState?.('saving');
    void fetchCloudAudioBlob(opts.text, opts.lang, controller.signal)
      .then((blob) => {
        if (gen !== this.generation) return;
        this.onCloudAudioState?.('cached');
        this.playBlob(blob, opts, gen);
      })
      .catch(() => {
        if (gen !== this.generation) return;
        // The Free Mongolian route was selected specifically because there is
        // no compatible device voice. Falling back here only creates silence
        // and hides a useful cloud error from the player.
        if (this.forceCloudForLanguage(opts.lang)) {
          opts.onError(new Error('cloud-mongolian-voice-unavailable'));
          return;
        }
        this.fallback.speak(opts);
      });
  }

  private playBlob(blob: Blob, opts: SpeakOptions, gen: number): void {
    if (this.audio) this.audio.pause();
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
    this.objectUrl = URL.createObjectURL(blob);
    const audio = new Audio(this.objectUrl);
    audio.playbackRate = opts.rate;
    audio.volume = opts.volume ?? 1;
    this.audio = audio;
    audio.onplaying = () => {
      if (gen === this.generation) opts.onStart?.();
    };
    audio.onended = () => {
      if (gen !== this.generation) return;
      this.audio = null;
      opts.onEnd();
    };
    audio.onerror = (error) => {
      if (gen !== this.generation) return;
      this.audio = null;
      opts.onError(error);
    };
    void audio.play().catch(() => {
      if (gen === this.generation) this.fallback.speak(opts);
    });
  }

  stop(): void {
    this.generation += 1;
    this.controller?.abort();
    this.controller = null;
    if (this.audio) this.audio.pause();
    this.audio = null;
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
    this.objectUrl = null;
    this.fallback.stop();
  }
}
