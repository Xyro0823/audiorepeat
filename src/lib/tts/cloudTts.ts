

import { getAuthIdToken } from '@/lib/authStore';
import { audioCacheKey, getCachedAudioBlob, putCachedAudioBlob } from '@/lib/audio/cache';

/** Same-origin cloud speech. Azure credentials stay in the server route. */
let configuredPromise: Promise<boolean> | null = null;

export function cloudTtsConfigured(): Promise<boolean> {
  if (!configuredPromise) {
    configuredPromise = fetch('/api/tts', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) return false;
        const body = (await response.json()) as { configured?: unknown };
        return body.configured === true;
      })
      .catch(() => false);
  }
  return configuredPromise;
}


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

async function requestCloudAudio(
  text: string,
  lang: string,
  token: string,
  signal?: AbortSignal,
): Promise<Blob> {
  const response = await fetch('/api/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ text, lang }),
    signal,
  });
  if (!response.ok) throw new Error(`cloud-tts-${response.status}`);
  const type = response.headers.get('content-type') ?? '';
  if (!type.toLowerCase().startsWith('audio/')) throw new Error('cloud-tts-invalid-response');
  const blob = await response.blob();
  if (blob.size === 0 || blob.size > 2_000_000) throw new Error('cloud-tts-invalid-audio');
  return blob;
}

/** Generate one item on demand and cache it for subsequent/offline playback. */
export async function fetchCloudAudioBlob(
  text: string,
  lang: string,
  signal?: AbortSignal,
): Promise<Blob> {
  const key = audioCacheKey(text, lang);
  const cached = await getCachedAudioBlob(key);
  if (cached) return cached;
  const token = await getAuthIdToken();
  if (!token) throw new Error('cloud-tts-unauthenticated');
  const blob = await requestCloudAudio(text, lang, token, signal);
  await putCachedAudioBlob(key, blob);
  return blob;
}

export function prewarmSetAudio(words: PrewarmWord[], opts: PrewarmOptions): () => void {
  const maxWords = Math.max(0, Math.min(opts.maxWords ?? 60, words.length));
  const jobs = words.slice(0, maxWords).flatMap((word) => {
    const pending: Array<{ text: string; lang: string }> = [];
    if (!opts.targetVoiceURI) pending.push({ text: word.target, lang: opts.lang });
    if (!opts.translationVoiceURI && opts.nativeLang) {
      pending.push({ text: word.translation, lang: opts.nativeLang });
    }
    return pending;
  });
  const total = jobs.length;
  if (total === 0) {
    opts.onProgress?.(0, 0, 0, 0);
    return () => {};
  }

  let cancelled = false;
  let cursor = 0;
  let done = 0;
  let succeeded = 0;
  let failed = 0;
  const controllers = new Set<AbortController>();
  const report = () => opts.onProgress?.(done, total, succeeded, failed);
  report();

  void Promise.all([cloudTtsConfigured(), getAuthIdToken()]).then(async ([configured, token]) => {
    if (cancelled) return;
    if (!configured || !token) {
      done = total;
      failed = total;
      report();
      return;
    }
    const worker = async () => {
      while (!cancelled) {
        const index = cursor;
        cursor += 1;
        if (index >= total) return;
        const job = jobs[index];
        const key = audioCacheKey(job.text, job.lang);
        const controller = new AbortController();
        controllers.add(controller);
        try {
          const cached = await getCachedAudioBlob(key);
          if (!cached) {
            const blob = await requestCloudAudio(job.text, job.lang, token, controller.signal);
            await putCachedAudioBlob(key, blob);
          }
          if (!cancelled) succeeded += 1;
        } catch {
          if (!cancelled) failed += 1;
        } finally {
          controllers.delete(controller);
          if (!cancelled) {
            done += 1;
            report();
          }
        }
      }
    };
    const concurrency = Math.max(1, Math.min(opts.concurrency ?? 3, 6));
    await Promise.all(Array.from({ length: Math.min(concurrency, total) }, () => worker()));
  }).catch(() => {
    if (!cancelled) {
      done = total;
      failed = total;
      report();
    }
  });

  return () => {
    cancelled = true;
    for (const controller of controllers) controller.abort();
    controllers.clear();
  };
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
