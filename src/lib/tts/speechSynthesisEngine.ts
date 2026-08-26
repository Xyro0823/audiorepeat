import type { SpeakOptions, TTSEngine, TTSEngineVoice } from './engine';

const MAX_CHUNK_CHARS = 180; // Chrome silently truncates very long utterances
// If an utterance neither starts nor errors within this window, it was
// silently dropped (iOS Safari / some Chrome builds) — cancel and retry once.
const START_WATCHDOG_MS = 6000;
// iOS Safari pauses speech synthesis when the tab is backgrounded; a periodic
// resume() (a harmless no-op when not paused) keeps the queue draining.
const IOS_KEEPALIVE_MS = 10000;

const IS_IOS_WEBKIT =
  typeof navigator !== 'undefined' &&
  /iP(hone|ad|od)|Macintosh/.test(navigator.userAgent) &&
  /Safari/.test(navigator.userAgent) &&
  !/Chrome|CriOS|Edg/.test(navigator.userAgent);

/**
 * True on iOS/iPadOS WebKit (incl. standalone PWA). speechSynthesis is
 * suspended there when the tab backgrounds, so the player routes through the
 * cached-audio engine (real <audio> playback) and pre-generates blobs.
 */
export function isIOSWebKit(): boolean {
  return IS_IOS_WEBKIT;
}

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

/** Dev-only diagnostics — never surfaced to users, but visible in bug reports. */
function devWarn(...args: unknown[]): void {
  if (process.env.NODE_ENV !== 'production') console.warn('[tts]', ...args);
}

/**
 * Maximum time (ms) to wait for browser voices to load before declaring
 * them "available" (possibly empty).
 */
const VOICE_LOAD_TIMEOUT_MS = 1500;

/**
 * Canonical locale form for matching: lowercase with Windows-style
 * underscore separators converted to BCP-47 hyphens ("mn_MN" → "mn-mn").
 * Windows/Edge report voice tags like "en_US"; without this normalization
 * every comparison (exact and base) fails and the UI shows a false
 * "No voice for this language" state.
 */
const norm = (lang: string) => lang.toLowerCase().replace(/_/g, '-');

/** Extract the base language subtag (before the first hyphen), normalized. */
const base = (lang: string) => norm(lang).split('-')[0];

/**
 * Known-safe locale fallbacks for product languages whose bare BCP-47 tag may
 * not appear in any installed voice list. All keys are stored lowercase.
 * Each entry is a list of voice BCP-47 tags (lowercase) that are known to
 * produce correct speech for that language.
 */
const LOCALE_FALLBACKS: Record<string, string[]> = {
  mn: ['mn-mn'],
  'nb-no': ['nb-no', 'no-no', 'no'],
};

/** True when a voice's locale can serve the requested language without
 * crossing into an unrelated language (exact or same base subtag). */
function voiceMatchesLang(voice: TTSEngineVoice, lang: string): boolean {
  const v = norm(voice.lang);
  const target = norm(lang);
  return v === target || base(v) === base(target);
}

/**
 * Resolve a user-persisted voice choice safely. The saved voice is honored
 * only when it is still installed AND compatible with the language being
 * spoken; an incompatible or vanished pick falls back to automatic
 * language matching instead of speaking the wrong language.
 */
export function resolvePersistedVoice(
  voices: TTSEngineVoice[],
  lang: string,
  voiceURI: string | undefined,
): TTSEngineVoice | undefined {
  if (!voiceURI) return undefined;
  const saved = voices.find((v) => v.uri === voiceURI);
  return saved && voiceMatchesLang(saved, lang) ? saved : undefined;
}

/**
 * Best voice for a language: exact BCP-47 match first, then same-base-language
 * match using exact base-subtag comparison ("es-ES" → "es-MX" but never
 * "fi" → "fil-PH"), preferring offline (localService) voices. Locale tags
 * are normalized (case + "_" → "-") on both sides before comparing.
 *
 * Returns undefined when no voice matches — the caller must surface that
 * instead of letting the browser pick a wrong-language default.
 */
export function pickVoiceForLang(
  voices: TTSEngineVoice[],
  lang: string,
): TTSEngineVoice | undefined {
  const target = norm(lang);
  const targetBase = base(target);

  // Try a single matching pass against a voice list, returning the first match.
  const matchIn = (pool: TTSEngineVoice[]): TTSEngineVoice | undefined => {
    // 1. Exact BCP-47 match (after case + underscore normalization)
    const exact = pool.find((v) => norm(v.lang) === target);
    if (exact) return exact;
    // 2. Same base-subtag: voice base === target base (e.g. es-ES → es-MX)
    const sameBase = pool.find((v) => base(v.lang) === targetBase);
    if (sameBase) return sameBase;
    return undefined;
  };

  // Prefer matching local (offline) voice first, then matching online voice.
  // Never skip online voices entirely just because local voices exist — only
  // skip them if a local voice already matches the requested language.
  const local = voices.filter((v) => v.localService);
  const localMatch = matchIn(local);
  if (localMatch) return localMatch;

  const onlineMatch = matchIn(voices.filter((v) => !v.localService));
  if (onlineMatch) return onlineMatch;

  // Known-safe locale fallback (checks local first, then online)
  const fallbacks = LOCALE_FALLBACKS[target];
  if (fallbacks) {
    for (const fb of fallbacks) {
      const fbNorm = norm(fb);
      const fbExact = (v: TTSEngineVoice) => norm(v.lang) === fbNorm;
      const fbBase = (v: TTSEngineVoice) => base(v.lang) === base(fbNorm);
      const fbLocal = local.find((v) => fbExact(v) || fbBase(v));
      if (fbLocal) return fbLocal;
      const fbOnline = voices.find((v) => !v.localService && (fbExact(v) || fbBase(v)));
      if (fbOnline) return fbOnline;
    }
  }

  return undefined;
}

/**
 * Zero-cost engine backed by the native Web Speech API.
 * Hardened against the known browser quirks:
 *  - getVoices() loads asynchronously (voiceschanged event + timeout safety net),
 *    and speak() always awaits that before the first utterance — so a word is
 *    never spoken into an empty voice registry (silent drop / wrong default).
 *  - the voice is picked explicitly by language (exact -> base-prefix, offline
 *    preferred) instead of trusting the browser's default resolution of u.lang.
 *  - speak() cancels first so overlapping utterances can never queue up and
 *    silently drop (Chrome); a per-utterance token makes async speaks mutually
 *    exclusive with stop().
 *  - a watchdog retries once when an utterance never starts (silent drop on
 *    iOS Safari), then surfaces an error so the player loop can move on.
 *  - iOS Safari keeps the queue alive with a periodic resume() while speaking.
 *  - very long utterances get silently cut off -> chunking
 *  - pause()/resume() is unreliable in Chromium -> stop() is cancel-based
 */
export class SpeechSynthesisEngine implements TTSEngine {
  readonly id = 'speech-synthesis';
  private synth: SpeechSynthesis | null;
  private voices: TTSEngineVoice[] = [];
  private stopped = true;
  /** Invalidates interleaved async speaks — stop() or a newer speak() bumps it. */
  private speakToken = 0;
  private keepAlive: number | null = null;

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
      const target = norm(lang);
      const exact = list.filter((v) => norm(v.lang) === target);
      if (exact.length) list = exact;
      else {
        // Base-subtag boundary ("es" matches "es-ES", never "esk"-style tags)
        const prefix = base(target);
        const partial = list.filter((v) => {
          const vNorm = norm(v.lang);
          return vNorm === prefix || vNorm.startsWith(prefix + '-');
        });
        if (partial.length) list = partial;
      }
    }
    return list;
  }

  loadVoices(): Promise<TTSEngineVoice[]> {
    return this.ensureVoicesLoaded();
  }

  /** Resolve once voices are populated, or after a short timeout as a fallback.
   *  Settles exactly once — cleans up the listener and timer after settling. */
  private ensureVoicesLoaded(): Promise<TTSEngineVoice[]> {
    return new Promise((resolve) => {
      if (!this.synth) {
        resolve([]);
        return;
      }
      let settled = false;
      let timer: number | null = null;
      let listener: (() => void) | null = null;

      const settle = (voices: TTSEngineVoice[]) => {
        if (settled) return;
        settled = true;
        if (timer !== null) { clearTimeout(timer); timer = null; }
        if (listener !== null) {
          this.synth?.removeEventListener('voiceschanged', listener);
          listener = null;
        }
        resolve(voices);
      };

      const read = () => {
        const v = this.synth?.getVoices();
        if (v && v.length > 0) {
          this.voices = v.map(toVoice);
          settle(this.voices);
          return true;
        }
        return false;
      };

      if (read()) return;

      // voiceschanged may fire before or after the listener is attached
      listener = () => read();
      this.synth.addEventListener('voiceschanged', listener, { once: true });
      timer = window.setTimeout(() => {
        // If registry is still empty, settle with empty — never leave hanging.
        if (!settled) read();
        if (!settled) settle([]);
      }, VOICE_LOAD_TIMEOUT_MS);
    });
  }

  speak(opts: SpeakOptions): void {
    const token = ++this.speakToken;
    // Calling cancel() after an utterance has naturally ended is a Chromium
    // footgun: Chrome can silently discard the next utterance until the user
    // stops and starts again. Only interrupt an actually active queue.
    const shouldCancelActiveSpeech = Boolean(this.synth?.speaking || this.synth?.pending);
    this.stopped = false;
    void this.speakAsync(opts, token, shouldCancelActiveSpeech);
  }

  private async speakAsync(
    opts: SpeakOptions,
    token: number,
    shouldCancelActiveSpeech: boolean,
  ): Promise<void> {
    const synth = this.synth;
    if (!synth) {
      opts.onError(new Error('SpeechSynthesis is unavailable in this browser'));
      return;
    }
    // Clean cancel-before-speak: never queue a new utterance behind one that
    // is still speaking — overlapping utterances silently drop in Chromium.
    if (shouldCancelActiveSpeech) synth.cancel();
    // Wait for voices to populate before the first utterance (silent-drop /
    // wrong-default-voice fix). Timeout-guarded, so headless/empty registries
    // still proceed and let the browser try u.lang.
    await this.ensureVoicesLoaded();
    if (this.stopped || token !== this.speakToken) return; // cancelled while waiting

    const voice = this.pickVoice(opts.lang, opts.voiceURI);
    if (opts.voiceURI && !voice) {
      devWarn(
        `voice "${opts.voiceURI}" not found for lang "${opts.lang}" — falling back to language match`,
      );
    }
    if (!voice && this.voices.length > 0) {
      devWarn(
        `no voice available for lang "${opts.lang}" — the browser may speak it in the wrong language or stay silent`,
      );
    }
    const chunks = chunkText(opts.text, MAX_CHUNK_CHARS);
    this.speakChunks(chunks, opts, token, voice);
  }

  /** Resolve the voice: a persisted choice that is still installed AND
   * language-compatible, else the best automatic language match (or none). */
  private pickVoice(lang: string, voiceURI?: string): TTSEngineVoice | undefined {
    const fresh = (this.synth?.getVoices() ?? []).map(toVoice);
    if (fresh.length > 0) this.voices = fresh;
    const persisted = resolvePersistedVoice(fresh.length > 0 ? fresh : this.voices, lang, voiceURI);
    if (persisted) return persisted;
    return pickVoiceForLang(this.voices, lang);
  }

  private speakChunks(
    chunks: string[],
    opts: SpeakOptions,
    token: number,
    voice: TTSEngineVoice | undefined,
  ): void {
    const synth = this.synth;
    if (!synth) return;
    this.startKeepAlive();

    const speakChunk = (index: number, retried: boolean) => {
      if (this.stopped || token !== this.speakToken) {
        this.stopKeepAlive();
        return;
      }
      const u = new SpeechSynthesisUtterance(chunks[index]);
      // Map our lightweight voice record back to the live SpeechSynthesisVoice
      // (u.voice requires the native type). Missing from the registry -> keep
      // u.lang and let the engine try its own resolution.
      const rawVoice = voice
        ? synth.getVoices().find((v) => v.voiceURI === voice.uri) ?? null
        : null;
      if (rawVoice) {
        u.voice = rawVoice;
        u.lang = rawVoice.lang; // keep both in sync — some engines ignore a lone u.lang
      } else {
        u.lang = voice?.lang ?? opts.lang;
      }
      u.rate = opts.rate;
      u.volume = opts.volume ?? 1;

      let started = false;
      // Watchdog: an utterance that never fires onstart was silently dropped
      // (iOS Safari, Chrome after rapid cancellation). Cancel, retry once, then
      // surface the error so the player loop skips the word instead of stalling.
      const watchdog = window.setTimeout(() => {
        if (this.stopped || token !== this.speakToken || started) return;
        devWarn(
          `utterance never started (lang="${opts.lang}", text="${chunks[index].slice(0, 40)}")${
            retried ? ' — retry also failed' : ' — retrying once'
          }`,
        );
        synth.cancel();
        if (retried) {
          this.stopKeepAlive();
          opts.onError(new Error(`Speech synthesis did not start for "${chunks[index]}"`));
        } else {
          // give the cancel time to settle before re-speaking (Chrome bug workaround)
          window.setTimeout(() => speakChunk(index, true), 50);
        }
      }, START_WATCHDOG_MS);

      u.onstart = () => {
        started = true;
        clearTimeout(watchdog);
        opts.onStart?.();
      };
      u.onend = () => {
        clearTimeout(watchdog);
        if (this.stopped || token !== this.speakToken) return;
        if (index + 1 < chunks.length) speakChunk(index + 1, retried);
        else {
          this.stopped = true;
          this.stopKeepAlive();
          opts.onEnd();
        }
      };
      u.onerror = (e) => {
        clearTimeout(watchdog);
        // "canceled"/"interrupted" are expected when stop() was called — not errors
        if (this.stopped || token !== this.speakToken || e.error === 'canceled' || e.error === 'interrupted')
          return;
        this.stopKeepAlive();
        opts.onError(e);
      };
      synth.speak(u);
    };

    speakChunk(0, false);
  }

  private startKeepAlive(): void {
    if (!IS_IOS_WEBKIT || this.keepAlive !== null) return;
    const synth = this.synth;
    if (!synth) return;
    this.keepAlive = window.setInterval(() => {
      if (this.stopped) {
        this.stopKeepAlive();
        return;
      }
      try {
        synth.resume(); // no-op when not paused; revives synthesis after backgrounding
      } catch {
        // ignore
      }
    }, IOS_KEEPALIVE_MS);
  }

  private stopKeepAlive(): void {
    if (this.keepAlive !== null) {
      clearInterval(this.keepAlive);
      this.keepAlive = null;
    }
  }

  stop(): void {
    this.stopped = true;
    this.speakToken += 1;
    this.stopKeepAlive();
    this.synth?.cancel();
  }
}
