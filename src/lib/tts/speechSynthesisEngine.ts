import type { SpeakOptions, TTSEngine, TTSEngineVoice } from './engine';

const MAX_CHUNK_CHARS = 180; // Chrome silently truncates very long utterances

function chunkText(text: string, max: number): string[] {
  if (text.length <= max) return [text];
  const sentences = text.match(/[^.!?。！？]+[.!?。！？]*\s*/g) ?? [text];
  const chunks: string[] = [];
  let current = '';
  for (const part of sentences) {
    if ((current + part).length > max && current) {
      chunks.push(current.trim());
      current = part;
    } else {
      current += part;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks.length > 0 ? chunks : [text];
}

const toVoice = (v: SpeechSynthesisVoice): TTSEngineVoice => ({
  name: v.name,
  lang: v.lang,
  localService: v.localService,
  uri: v.voiceURI,
  isDefault: v.default,
});

/**
 * Zero-cost engine backed by the native Web Speech API.
 * Hardened against the known browser quirks:
 *  - getVoices() loads asynchronously (voiceschanged event + timeout safety net)
 *  - very long utterances get silently cut off -> chunking
 *  - pause()/resume() is unreliable in Chromium -> stop() is cancel-based
 */
export class SpeechSynthesisEngine implements TTSEngine {
  readonly id = 'speech-synthesis';
  private synth: SpeechSynthesis | null;
  private voices: TTSEngineVoice[] = [];
  private stopped = true;

  constructor(synth?: SpeechSynthesis) {
    this.synth =
      synth ??
      (typeof window !== 'undefined' && 'speechSynthesis' in window
        ? window.speechSynthesis
        : null);
  }

  getVoices(lang?: string): TTSEngineVoice[] {
    if (!this.synth) return [];
    const fresh = this.synth.getVoices();
    if (fresh.length > 0) this.voices = fresh.map(toVoice);
    let list = this.voices;
    if (lang && list.length > 0) {
      const exact = list.filter((v) => v.lang.toLowerCase() === lang.toLowerCase());
      if (exact.length) list = exact;
      else {
        const prefix = lang.split('-')[0].toLowerCase();
        const partial = list.filter((v) => v.lang.toLowerCase().startsWith(prefix));
        if (partial.length) list = partial;
      }
    }
    return list;
  }

  loadVoices(): Promise<TTSEngineVoice[]> {
    return new Promise((resolve) => {
      if (!this.synth) {
        resolve([]);
        return;
      }
      const read = () => {
        const v = this.synth?.getVoices();
        if (v && v.length > 0) {
          this.voices = v.map(toVoice);
          resolve(this.voices);
          return true;
        }
        return false;
      };
      if (read()) return;
      // voiceschanged may fire before or after the listener is attached
      this.synth.addEventListener('voiceschanged', () => read(), { once: true });
      window.setTimeout(() => {
        if (this.voices.length === 0) read();
      }, 300);
    });
  }

  speak(opts: SpeakOptions): void {
    const synth = this.synth;
    if (!synth) {
      opts.onError(new Error('SpeechSynthesis is unavailable in this browser'));
      return;
    }
    this.stopped = false;
    const chunks = chunkText(opts.text, MAX_CHUNK_CHARS);

    const speakChunk = (index: number) => {
      if (this.stopped) return; // cancelled — the hook invalidated us via its token
      const u = new SpeechSynthesisUtterance(chunks[index]);
      u.lang = opts.lang;
      u.rate = opts.rate;
      if (opts.voiceURI) {
        const voice = synth.getVoices().find((v) => v.voiceURI === opts.voiceURI);
        if (voice) u.voice = voice;
      }
      u.onstart = () => opts.onStart?.();
      u.onend = () => {
        if (this.stopped) return;
        if (index + 1 < chunks.length) speakChunk(index + 1);
        else {
          this.stopped = true;
          opts.onEnd();
        }
      };
      u.onerror = (e) => {
        // "canceled"/"interrupted" are expected when stop() was called — not errors
        if (this.stopped || e.error === 'canceled' || e.error === 'interrupted') return;
        this.stopped = true;
        opts.onError(e);
      };
      synth.speak(u);
    };

    speakChunk(0);
  }

  stop(): void {
    this.stopped = true;
    this.synth?.cancel();
  }
}
