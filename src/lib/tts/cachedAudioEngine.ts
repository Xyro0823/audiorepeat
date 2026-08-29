import { audioCacheKey, getCachedAudioBlob } from '@/lib/audio/cache';
import type { SpeakOptions, TTSEngine, TTSEngineVoice } from './engine';

/**
 * Hybrid offline engine.
 * 1. Looks up a pre-generated audio blob in the Cache API (keyed by lang|rate|voice|text).
 * 2. Hit  -> plays it through an <audio> element (real Media Session / background audio).
 * 3. Miss -> delegates to the fallback engine (speechSynthesis, or cloud TTS later).
 * Used when the user enables "cached audio" (and by default on iOS, where
 * speechSynthesis is suspended on lock screens) — cloudTts.prewarmSetAudio()
 * writes blobs via putCachedAudioBlob(), and the service worker also caches
 * /audio/* at runtime.
 *
 * The `generation` counter guards the async cache lookup: if stop() or a newer
 * speak() lands while a lookup is in flight, the stale result is dropped so a
 * cancelled word can never start playing after playback stopped.
 */
export class CachedAudioEngine implements TTSEngine {
  readonly id = 'cached-audio';
  private fallback: TTSEngine;
  // Keep one media element for the lifetime of this engine. In iOS Safari a
  // newly created Audio() after the first word can lose the original user
  // activation, even though a listening loop is still in progress. Reusing
  // the element keeps the loop in the same media session.
  private audio: HTMLAudioElement | null = null;
  private objectUrl: string | null = null;
  private generation = 0;

  constructor(fallback: TTSEngine) {
    this.fallback = fallback;
  }

  getVoices(lang?: string): TTSEngineVoice[] {
    return this.fallback.getVoices(lang);
  }

  loadVoices(): Promise<TTSEngineVoice[]> {
    return this.fallback.loadVoices();
  }

  speak(opts: SpeakOptions): void {
    const gen = ++this.generation;
    const key = audioCacheKey(opts.text, opts.lang, opts.voiceURI);
    getCachedAudioBlob(key)
      .then((blob) => {
        // a newer speak() or stop() superseded this lookup — drop it silently
        if (gen !== this.generation) return;
        if (blob) this.playBlob(blob, opts, gen);
        else this.fallback.speak(opts);
      })
      .catch(() => {
        if (gen !== this.generation) return;
        this.fallback.speak(opts);
      });
  }

  private playBlob(blob: Blob, opts: SpeakOptions, gen: number): void {
    // Reuse the first audio element rather than creating one per word. See
    // the field comment: that is essential for continuous iOS playback.
    const audio = this.audio ?? new Audio();
    this.audio = audio;
    // stop any previously playing audio before starting the new one
    audio.pause();
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
    this.objectUrl = URL.createObjectURL(blob);
    audio.src = this.objectUrl;
    audio.playbackRate = opts.rate;
    audio.volume = opts.volume ?? 1;
    this.audio = audio;

    // Keep the media-session / onWordChange contract identical to the speech
    // path: onStart fires when playback actually begins (cached blobs previously
    // skipped it, leaving the lock screen stuck on a stale word).
    audio.onplaying = () => {
      if (gen !== this.generation) return;
      opts.onStart?.();
    };
    audio.onended = () => {
      if (gen !== this.generation) return;
      opts.onEnd();
    };
    audio.onerror = () => {
      if (gen !== this.generation) return;
      // A stale/corrupt Cache API blob must not stop an entire listening loop.
      // Match the rejected-play fallback below: discard the bad cached attempt
      // and let the device/cloud engine speak this one item instead.
      if (this.objectUrl) {
        URL.revokeObjectURL(this.objectUrl);
        this.objectUrl = null;
      }
      this.fallback.speak(opts);
    };
    audio.play().catch(() => {
      // autoplay policy or decode failure -> fall back to speech synthesis
      if (gen !== this.generation) return;
      if (this.objectUrl) {
        URL.revokeObjectURL(this.objectUrl);
        this.objectUrl = null;
      }
      this.fallback.speak(opts);
    });
  }

  stop(): void {
    this.generation += 1; // drop any in-flight cache lookup
    if (this.audio) {
      this.audio.pause();
    }
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }
    this.fallback.stop();
  }
}
