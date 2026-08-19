

/**
 * Cloud TTS pre-generation — currently DISABLED.
 *
 * Previous versions used Google Translate TTS through third-party CORS proxies
 * (allorigins, corsproxy.io, codetabs) to pre-generate audio blobs for offline
 * iOS lock-screen playback. These proxies send user vocabulary to third-party
 * servers without explicit consent, which conflicts with the Privacy Policy.
 *
 * All proxy sources have been removed. The prewarm infrastructure is retained
 * so that if a first-party/same-origin TTS provider is added in the future, it
 * can be plugged in without changing the cache key format or the player's
 * cached-audio engine.
 *
 * For now, every prewarm call is a no-op and the player falls back to device
 * speechSynthesis. There is no manual export/import path.
 *
 * Cache key format (lang|voice|text — see audioCacheKey) must remain stable
 * so old blobs don't go stale if/when a provider is added.
 */


export interface PrewarmWord {
  id: string;
  target: string;
  translation: string;
}

interface PrewarmOptions {
  lang: string;
  nativeLang?: string;
  targetVoiceURI?: string;
  translationVoiceURI?: string;
  maxWords?: number;
  concurrency?: number;
  onProgress?: (done: number, total: number, succeeded: number, failed: number) => void;
}

/**
 * No-op prewarm — returns immediately and reports zero work.
 * Network TTS prewarming is disabled to prevent uploading user vocabulary
 * to third-party servers without explicit informed consent.
 */
export function prewarmSetAudio(_words: PrewarmWord[], opts: PrewarmOptions): () => void {
  // Report zero work so the shared manager never leaves a run "active" forever.
  opts.onProgress?.(0, 0, 0, 0);
  return () => {};
}

/* ------------------------------------------------------------------ */
/* Shared prewarm manager                                             */
/* ------------------------------------------------------------------ */

const PREWARM_ADOPTION_MS = 10_000;

export interface PrewarmProgress {
  active: boolean;
  done: number;
  total: number;
  succeeded: number;
  failed: number;
  startedAt: number;
}

export interface PrewarmHandle {
  key: string;
  getProgress(): PrewarmProgress;
  subscribe(cb: (p: PrewarmProgress) => void): () => void;
  summaryShown(): boolean;
  markSummaryShown(): void;
  cancel(): void;
}

interface ActiveRun {
  key: string;
  cancelQueue: () => void;
  progress: PrewarmProgress;
  listeners: Set<(p: PrewarmProgress) => void>;
  summaryNotified: boolean;
  adoptionTimer?: number;
}

let activeRun: ActiveRun | null = null;

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
        window.clearTimeout(run.adoptionTimer);
        run.adoptionTimer = undefined;
      }
      cb({ ...run.progress });
      return () => { run.listeners.delete(cb); };
    },
    summaryShown: () => run.summaryNotified,
    markSummaryShown: () => { run.summaryNotified = true; },
    cancel: () => run.cancelQueue(),
  };
}

export interface RequestPrewarmOptions extends PrewarmOptions {
  key: string;
}

export function requestSetPrewarm(words: PrewarmWord[], opts: RequestPrewarmOptions): PrewarmHandle {
  if (activeRun && activeRun.key === opts.key) {
    return makeHandle(activeRun);
  }
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
    if (activeRun === run) activeRun = null;
  };
  run.adoptionTimer = window.setTimeout(() => {
    if (activeRun === run && run.listeners.size === 0) {
      run.cancelQueue();
      if (activeRun === run) activeRun = null;
    }
  }, PREWARM_ADOPTION_MS);
  activeRun = run;
  return makeHandle(run);
}
