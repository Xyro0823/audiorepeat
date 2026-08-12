import { audioCacheKey, putCachedAudioBlob } from '@/lib/audio/cache';

/**
 * Best-effort cloud TTS used to pre-generate audio blobs so playback can run
 * through a real <audio> element — the only path that keeps playing on an iOS
 * lock screen (speechSynthesis is suspended when the tab backgrounds).
 *
 * Every source here is free/keyless, which means none of them is guaranteed:
 * Google's endpoint has the best language coverage but no CORS headers, so it
 * is fetched through third-party proxies that can throttle or time out. To
 * keep warm-up reliable we try sources in order, abort each one after a short
 * timeout, and circuit-break any source that fails repeatedly. Every failure
 * is swallowed — a cache miss simply falls back to speechSynthesis at play
 * time, so this can never break playback.
 *
 * For production, swap TTS_SOURCES for a paid TTS provider. Keep the cache key
 * format (lang|voice|text — see audioCacheKey) stable, or old blobs go stale.
 */
const MAX_TEXT_CHARS = 180; // Google caps a single TTS request at ~200 chars
const TTS_TIMEOUT_MS = 6000;
const BREAKER_LIMIT = 3; // consecutive failures before a source is skipped

function googleTtsUrl(text: string, lang: string): string {
  const q = new URLSearchParams({
    ie: 'UTF-8',
    client: 'tw-ob',
    tl: lang,
    q: text,
    total: '1',
    idx: '0',
    textlen: String(text.length),
  }).toString();
  return `https://translate.google.com/translate_tts?${q}`;
}

/** fetch() with a hard abort so a hanging proxy can't stall the warm-up queue. */
async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    window.clearTimeout(timer);
  }
}

async function fetchAudioOrThrow(url: string, label: string): Promise<Blob> {
  const res = await fetchWithTimeout(url, TTS_TIMEOUT_MS);
  if (!res.ok) throw new Error(`${label}: ${res.status}`);
  const blob = await res.blob();
  if (blob.type && !blob.type.startsWith('audio/')) throw new Error(`${label}: not audio`);
  return blob;
}

type TtsSource = (text: string, lang: string) => Promise<Blob>;

const TTS_SOURCES: TtsSource[] = [
  // Direct Google — fails fast where the endpoint rejects the origin (no CORS).
  (text, lang) => fetchAudioOrThrow(googleTtsUrl(text, lang), 'google tts'),
  // Third-party CORS proxies in front of Google Translate TTS.
  (text, lang) =>
    fetchAudioOrThrow(
      `https://api.allorigins.win/raw?url=${encodeURIComponent(googleTtsUrl(text, lang))}`,
      'allorigins',
    ),
  (text, lang) =>
    fetchAudioOrThrow(
      `https://corsproxy.io/?url=${encodeURIComponent(googleTtsUrl(text, lang))}`,
      'corsproxy.io',
    ),
  (text, lang) =>
    fetchAudioOrThrow(
      `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(googleTtsUrl(text, lang))}`,
      'codetabs',
    ),
];

/** Consecutive-failure counts per source; reset on success. Module-level so a
 *  dead proxy stays dead across sets instead of burning a timeout per word. */
const sourceFailures = TTS_SOURCES.map(() => 0);

async function fetchCloudTtsBlob(text: string, lang: string): Promise<Blob> {
  let lastErr: unknown = new Error('no TTS sources');
  for (let i = 0; i < TTS_SOURCES.length; i += 1) {
    if (sourceFailures[i] >= BREAKER_LIMIT) continue; // circuit open — skip
    try {
      const blob = await TTS_SOURCES[i](text, lang);
      sourceFailures[i] = 0; // healthy again
      return blob;
    } catch (err) {
      sourceFailures[i] += 1;
      lastErr = err;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('all TTS sources failed');
}

export interface PrewarmWord {
  id: string;
  target: string;
  translation: string;
}

interface PrewarmOptions {
  lang: string;
  nativeLang?: string;
  /** When set, target words are skipped (explicit device voice → speechSynthesis). */
  targetVoiceURI?: string;
  /** When set, translations are skipped. */
  translationVoiceURI?: string;
  /** Cap on words to warm — guards huge C1/C2 sets against request floods. */
  maxWords?: number;
  /** Concurrent fetches; keep low — free sources rate-limit per IP. */
  concurrency?: number;
  /**
   * Called after each word completes (a target + its translation count as one
   * word). `done`/`total` are words, `succeeded`/`failed` track how many of
   * those were cached vs. fell back to speechSynthesis. The callback may be
   * omitted — it is purely observational and never gates warm-up.
   */
  onProgress?: (done: number, total: number, succeeded: number, failed: number) => void;
}

/**
 * Generate + cache audio for a set in the background. Returns a cancel
 * function. Blobs are written under the same audioCacheKey() the
 * CachedAudioEngine reads at play time, so once warmed, words play through a
 * real <audio> element (lock-screen / background-safe) instead of TTS.
 */
export function prewarmSetAudio(words: PrewarmWord[], opts: PrewarmOptions): () => void {
  let cancelled = false;
  const maxWords = opts.maxWords ?? 150;
  const concurrency = Math.max(1, opts.concurrency ?? 3);

  // Dedupe by cache key — the same text+lang can appear across words.
  const seen = new Set<string>();
  const tasks: Array<{ text: string; lang: string }> = [];
  for (const w of words.slice(0, maxWords)) {
    if (!opts.targetVoiceURI) {
      const text = w.target.trim();
      if (text.length > 0 && text.length <= MAX_TEXT_CHARS) {
        const key = audioCacheKey(text, opts.lang);
        if (!seen.has(key)) {
          seen.add(key);
          tasks.push({ text, lang: opts.lang });
        }
      }
    }
    if (!opts.translationVoiceURI && opts.nativeLang) {
      const text = w.translation.trim();
      if (text.length > 0 && text.length <= MAX_TEXT_CHARS) {
        const key = audioCacheKey(text, opts.nativeLang);
        if (!seen.has(key)) {
          seen.add(key);
          tasks.push({ text, lang: opts.nativeLang });
        }
      }
    }
  }
  if (tasks.length === 0) {
    // Nothing to warm (e.g. every voice is an explicit pick) — still report a
    // completed run so the shared manager never leaves a run "active" forever.
    opts.onProgress?.(0, 0, 0, 0);
    return () => {};
  }

  let next = 0;
  let done = 0;
  let succeeded = 0;
  let failed = 0;
  const total = tasks.length;

  const run = async () => {
    while (!cancelled) {
      const i = next;
      next += 1;
      if (i >= tasks.length) break;
      const { text, lang } = tasks[i];
      try {
        const blob = await fetchCloudTtsBlob(text, lang);
        if (cancelled) return;
        await putCachedAudioBlob(audioCacheKey(text, lang), blob);
        succeeded += 1;
      } catch {
        // best-effort — a miss just falls back to speechSynthesis
        failed += 1;
      }
      done += 1;
      opts.onProgress?.(done, total, succeeded, failed);
    }
  };

  for (let i = 0; i < Math.min(concurrency, tasks.length); i += 1) void run();

  return () => {
    cancelled = true;
  };
}

/* ------------------------------------------------------------------ */
/* Shared prewarm manager                                             */
/* ------------------------------------------------------------------ */
/**
 * Warm-up is triggered from two places for the same set: SetLibrary starts it
 * the moment a set is tapped (before the player screen mounts — the whole
 * point of this being an iOS lock-screen feature), and PlayerView also
 * requests it on mount. This manager keeps ONE run per set+config so the two
 * triggers never start duplicate queues, and it lets late subscribers (the
 * player mounting after warm-up already made progress) read the current
 * snapshot synchronously instead of seeing a misleading 0/Y reset.
 *
 * Lifecycle: a run starts via requestSetPrewarm(), is adopted when the first
 * subscriber attaches (an adoption deadline cancels it if nobody ever does —
 * e.g. the user tapped a set but navigated away before the player loaded),
 * is superseded by a different set/config, and is retained briefly after
 * completing so a same-key request reuses it instead of re-fetching.
 */

const PREWARM_ADOPTION_MS = 10_000; // grace period before an unadopted run is cancelled

export interface PrewarmProgress {
  /** True while the queue is still processing. */
  active: boolean;
  done: number;
  total: number;
  succeeded: number;
  failed: number;
  /** Epoch ms when the run started — lets callers judge "was it fast?". */
  startedAt: number;
}

export interface PrewarmHandle {
  /** Stable identity of the run (set id + language + voice config). */
  key: string;
  /** Current snapshot — late subscribers see real progress, not a reset. */
  getProgress(): PrewarmProgress;
  /** cb fires immediately with the current snapshot, then on every tick. */
  subscribe(cb: (p: PrewarmProgress) => void): () => void;
  /** Whether a failure summary was already surfaced (shown once per run). */
  summaryShown(): boolean;
  markSummaryShown(): void;
  /** Cancel the queue (no-op if already finished/cancelled). */
  cancel(): void;
}

interface ActiveRun {
  key: string;
  cancelQueue: () => void;
  progress: PrewarmProgress;
  listeners: Set<(p: PrewarmProgress) => void>;
  summaryNotified: boolean;
  /** Pending adoption-deadline timer, cleared once the run is subscribed to. */
  adoptionTimer?: number;
}

let activeRun: ActiveRun | null = null;

/** Stable key identifying one warm-up job — MUST be identical across callers. */
export function prewarmKey(
  setId: string,
  lang: string,
  nativeLang: string | undefined,
  targetVoiceURI: string | undefined,
  translationVoiceURI: string | undefined,
): string {
  return [setId, lang, nativeLang ?? '', targetVoiceURI ?? '', translationVoiceURI ?? ''].join('|');
}

function makeHandle(run: ActiveRun): PrewarmHandle {
  return {
    key: run.key,
    getProgress: () => ({ ...run.progress }),
    subscribe: (cb) => {
      run.listeners.add(cb);
      if (run.adoptionTimer !== undefined) {
        window.clearTimeout(run.adoptionTimer); // adopted — cancel the deadline
        run.adoptionTimer = undefined;
      }
      cb({ ...run.progress }); // immediate snapshot — late subscribers never see 0/Y
      return () => {
        run.listeners.delete(cb);
      };
    },
    summaryShown: () => run.summaryNotified,
    markSummaryShown: () => {
      run.summaryNotified = true;
    },
    cancel: () => run.cancelQueue(),
  };
}

export interface RequestPrewarmOptions extends PrewarmOptions {
  /** Stable identity for dedupe — see prewarmKey(). */
  key: string;
}

export function requestSetPrewarm(words: PrewarmWord[], opts: RequestPrewarmOptions): PrewarmHandle {
  // Same set+config already being warmed (or completed earlier this session)?
  // Reuse it — this is the dedupe between SetLibrary's tap-time trigger and
  // PlayerView's mount-time trigger.
  if (activeRun && activeRun.key === opts.key) {
    return makeHandle(activeRun);
  }
  // A different set/config supersedes the previous run — only one warm-up at
  // a time (free TTS sources rate-limit per IP; parallel queues would thrash).
  if (activeRun) {
    activeRun.cancelQueue();
    activeRun = null;
  }
  const run: ActiveRun = {
    key: opts.key,
    cancelQueue: () => {},
    progress: { active: true, done: 0, total: 0, succeeded: 0, failed: 0, startedAt: Date.now() },
    listeners: new Set(),
    summaryNotified: false,
  };
  const cancelQueue = prewarmSetAudio(words, {
    ...opts,
    onProgress: (done, total, succeeded, failed) => {
      run.progress.done = done;
      run.progress.total = total;
      run.progress.succeeded = succeeded;
      run.progress.failed = failed;
      if (done >= total) run.progress.active = false;
      for (const l of run.listeners) l({ ...run.progress });
    },
  });
  run.cancelQueue = () => {
    cancelQueue();
    run.progress.active = false;
    if (run.adoptionTimer !== undefined) {
      window.clearTimeout(run.adoptionTimer);
      run.adoptionTimer = undefined;
    }
    // A cancelled run must not be reused by a later same-key request — it
    // would "complete" silently without ever running the queue to the end.
    if (activeRun === run) activeRun = null;
  };
  // Adoption deadline: if nobody subscribes (the player never mounts — the
  // user tapped a set but navigated away), stop the background queue rather
  // than leak work. Subscribe() clears this timer.
  run.adoptionTimer = window.setTimeout(() => {
    if (activeRun === run && run.listeners.size === 0) {
      run.cancelQueue();
      if (activeRun === run) activeRun = null;
    }
  }, PREWARM_ADOPTION_MS);
  activeRun = run;
  return makeHandle(run);
}
