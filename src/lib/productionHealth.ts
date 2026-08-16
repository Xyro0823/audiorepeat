/**
 * Pure, unit-testable helpers for the read-only Production health check
 * (scripts/production-health.mjs). No network, no Node-specific imports —
 * everything here is exercised by src/lib/productionHealth.test.ts without
 * touching the internet. The CLI wires these to fetch; the decisions
 * (status matching, JSON validation, no-store detection, retry/timeout
 * behavior, manifest structure) live here so they can be tested in isolation.
 */

export type JsonResult = { ok: true; value: unknown } | { ok: false; error: string };

/** Parse a response body as JSON. Reports a human-readable error on failure. */
export function parseJsonBody(text: string): JsonResult {
  if (!text.trim()) return { ok: false, error: 'empty body' };
  try {
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'invalid JSON' };
  }
}

/** Tolerant status matching: exact number or one of several acceptable codes. */
export function statusIs(actual: number, expected: number | readonly number[]): boolean {
  return Array.isArray(expected) ? expected.includes(actual) : actual === expected;
}

/**
 * True when the Cache-Control header contains a no-store directive.
 * Tolerant of ordering, casing, and extra directives (e.g.
 * "public, max-age=0, no-store" or "NO-STORE" both match).
 */
export function cacheControlHasNoStore(value: string | null | undefined): boolean {
  if (!value) return false;
  return value
    .split(',')
    .map((directive) => directive.trim().toLowerCase())
    .includes('no-store');
}

function isPlainObject(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

export interface ManifestCheckResult {
  ok: boolean;
  problems: string[];
}

/**
 * Structural check for /data/vocab/manifest.json: a plain object with at
 * least `minLanguages` language keys, each mapping to an object that carries
 * numeric level counts. Tolerant by design — no exact counts are hardcoded.
 */
export function vocabManifestChecks(manifest: unknown, minLanguages = 13): ManifestCheckResult {
  const problems: string[] = [];
  if (!isPlainObject(manifest)) {
    problems.push('not a JSON object');
    return { ok: false, problems };
  }
  const langs = Object.keys(manifest);
  if (langs.length < minLanguages) {
    problems.push(`expected >= ${minLanguages} languages, found ${langs.length}`);
  }
  for (const lang of langs) {
    const entry = manifest[lang];
    if (!isPlainObject(entry)) {
      problems.push(`language "${lang}" entry is not an object`);
    } else if (!Object.values(entry).some((v) => typeof v === 'number')) {
      problems.push(`language "${lang}" entry has no numeric level counts`);
    }
  }
  return { ok: problems.length === 0, problems };
}

/**
 * Structural check for /data/topics/manifest.json: a plain object with at
 * least `minTopics` topic keys, each mapping to an object with a string
 * `label` and a `langs` object. Tolerant by design — no exact counts.
 */
export function topicManifestChecks(manifest: unknown, minTopics = 19): ManifestCheckResult {
  const problems: string[] = [];
  if (!isPlainObject(manifest)) {
    problems.push('not a JSON object');
    return { ok: false, problems };
  }
  const topics = Object.keys(manifest);
  if (topics.length < minTopics) {
    problems.push(`expected >= ${minTopics} topics, found ${topics.length}`);
  }
  for (const id of topics) {
    const entry = manifest[id];
    if (!isPlainObject(entry)) {
      problems.push(`topic "${id}" entry is not an object`);
    } else {
      if (typeof entry.label !== 'string') problems.push(`topic "${id}" missing string label`);
      if (!isPlainObject(entry.langs)) problems.push(`topic "${id}" missing langs object`);
    }
  }
  return { ok: problems.length === 0, problems };
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Reject if `promise` does not settle within `ms`. The original promise is
 * not cancelled (the caller owns cancellation, e.g. via AbortSignal) — this
 * only guarantees the health check cannot hang on a stuck request.
 */
export async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export interface RetryOptions {
  /** Total attempts (>= 1). */
  attempts: number;
  /** Base backoff for the first retry; doubles per attempt. */
  baseDelayMs: number;
  /** Optional random jitter added to each backoff. */
  jitterMs?: number;
}

/**
 * Run `fn` up to `attempts` times, backing off exponentially between
 * attempts. Resolves with the first success; rejects with the last error
 * once attempts are exhausted.
 */
export async function retry<T>(
  fn: () => Promise<T>,
  { attempts, baseDelayMs, jitterMs = 0 }: RetryOptions,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt === attempts) break;
      const jitter = jitterMs > 0 ? Math.floor(Math.random() * jitterMs) : 0;
      await sleep(baseDelayMs * 2 ** (attempt - 1) + jitter);
    }
  }
  throw lastError;
}
