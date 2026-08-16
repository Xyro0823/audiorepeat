#!/usr/bin/env node
/**
 * Read-only Production health check for Evoq/AudioRepeat.
 *
 * Verifies the deployed site (https://audiorepeat.vercel.app by default) is
 * healthy after a push WITHOUT credentials, tokens, or any data mutation:
 *   - public pages return 200 page shells
 *   - public data manifests are 200 + valid JSON with the expected shape
 *   - admin/payment APIs reject unauthenticated calls (401/400) and send
 *     Cache-Control: no-store
 *   - the Paddle webhook safely rejects an unsigned request with 400
 *
 * No sign-in, no Firebase/Firestore writes, no checkout/Paddle calls with
 * real payloads. Exits 0 when every required check passes, non-zero on any
 * failure. Imports the pure decision helpers from src/lib/productionHealth.ts
 * (Node >= 23.6 strips types natively; Node 24 recommended — same as the
 * existing vocab:health CLI).
 *
 * Usage:
 *   npm run health:production
 *   node scripts/production-health.mjs --wait-deploy   # bounded poll for Vercel deploy
 *   PRODUCTION_BASE_URL=http://localhost:3000 node scripts/production-health.mjs
 */
import {
  cacheControlHasNoStore,
  parseJsonBody,
  retry,
  sleep,
  topicManifestChecks,
  vocabManifestChecks,
  withTimeout,
} from '../src/lib/productionHealth.ts';

const BASE = (process.env.PRODUCTION_BASE_URL || 'https://audiorepeat.vercel.app').replace(/\/+$/, '');
const WAIT_DEPLOY = process.argv.includes('--wait-deploy');
const WAIT_DEPLOY_CEILING_MS = 240_000; // 4 minutes — bounded, never infinite
const WAIT_DEPLOY_INTERVAL_MS = 15_000;
const REQUEST_TIMEOUT_MS = 12_000; // per-attempt timeout
const MAX_ATTEMPTS = 3; // per-check retries for transient/network/cold-start failures
const BASE_BACKOFF_MS = 1_000;

/** One request with a hard timeout (AbortSignal cancels the socket too). */
async function fetchOnce(url, init = {}) {
  return withTimeout(
    fetch(url, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) }),
    REQUEST_TIMEOUT_MS + 1_000,
    url,
  );
}

/**
 * Fetch with bounded retries. Retries on network/timeout errors AND transient
 * 5xx responses (Vercel cold starts can 503 briefly) so a healthy site does
 * not fail a single hiccup.
 */
async function fetchWithRetry(url, init = {}) {
  return retry(
    async () => {
      const res = await fetchOnce(url, init);
      if (res.status >= 500) {
        throw new Error(`${url} -> HTTP ${res.status} (server error)`);
      }
      return res;
    },
    { attempts: MAX_ATTEMPTS, baseDelayMs: BASE_BACKOFF_MS },
  );
}

/** Bounded poll for the newly deployed site to become reachable (Vercel deploys async). */
async function waitForDeploy() {
  const start = Date.now();
  const deadline = start + WAIT_DEPLOY_CEILING_MS;
  let attempt = 0;
  while (Date.now() < deadline) {
    attempt += 1;
    try {
      const res = await fetchOnce(`${BASE}/`, { method: 'GET' });
      const text = await res.text();
      if (res.status === 200 && text.trim().length > 0) {
        console.log(`✓ production reachable after ${Math.round((Date.now() - start) / 1000)}s (attempt ${attempt})`);
        return;
      }
    } catch {
      // Not ready yet — keep polling until the ceiling.
    }
    await sleep(WAIT_DEPLOY_INTERVAL_MS);
  }
  throw new Error(
    `production did not become reachable within ${Math.round(WAIT_DEPLOY_CEILING_MS / 1000)}s`,
  );
}

// ---- individual checks -----------------------------------------------------

/** Public page: 200 + non-empty HTML shell. */
async function checkPage(path) {
  try {
    const res = await fetchWithRetry(`${BASE}${path}`, { method: 'GET' });
    const body = await res.text();
    if (res.status !== 200) {
      return { route: path, ok: false, expected: '200', actual: `HTTP ${res.status}` };
    }
    if (body.trim().length === 0) {
      return { route: path, ok: false, expected: '200 + non-empty shell', actual: 'empty body' };
    }
    return { route: path, ok: true, expected: '200', actual: '200' };
  } catch (err) {
    return { route: path, ok: false, expected: '200', actual: err instanceof Error ? err.message : String(err) };
  }
}

/** Public data manifest: 200 + valid JSON + structural checks. */
async function checkManifest(path, label, validator, min) {
  try {
    const res = await fetchWithRetry(`${BASE}${path}`, { method: 'GET' });
    const text = await res.text();
    if (res.status !== 200) {
      return { route: path, ok: false, expected: '200', actual: `HTTP ${res.status}` };
    }
    const parsed = parseJsonBody(text);
    if (!parsed.ok) {
      return { route: path, ok: false, expected: 'valid JSON', actual: `invalid JSON: ${parsed.error}` };
    }
    const structural = validator(parsed.value, min);
    if (!structural.ok) {
      return {
        route: path,
        ok: false,
        expected: `${label} structure valid`,
        actual: structural.problems.join('; ') || 'unexpected shape',
      };
    }
    const count = Object.keys(parsed.value).length;
    return { route: path, ok: true, expected: 'valid JSON + structure', actual: `${label} valid (${count})` };
  } catch (err) {
    return {
      route: path,
      ok: false,
      expected: 'valid JSON + structure',
      actual: err instanceof Error ? err.message : String(err),
    };
  }
}

/** Auth-gated API: expected status + Cache-Control: no-store. */
async function checkApi(path, expectedStatus, expectNoStore = true, init = {}) {
  const opts = { method: init.method ?? 'GET' };
  if (init.body) {
    opts.body = init.body;
    opts.headers = { 'Content-Type': 'application/json' };
  }
  try {
    const res = await fetchWithRetry(`${BASE}${path}`, opts);
    const cc = res.headers.get('cache-control');
    const noStore = cacheControlHasNoStore(cc);
    const expected = `${expectedStatus}${expectNoStore ? ' + no-store' : ''}`;
    const actual = `HTTP ${res.status}${expectNoStore ? (noStore ? ' + no-store' : ' + MISSING no-store') : ''}`;
    return { route: path, ok: res.status === expectedStatus && (!expectNoStore || noStore), expected, actual };
  } catch (err) {
    const expected = `${expectedStatus}${expectNoStore ? ' + no-store' : ''}`;
    return { route: path, ok: false, expected, actual: err instanceof Error ? err.message : String(err) };
  }
}

// ---- run -------------------------------------------------------------------

async function main() {
  if (WAIT_DEPLOY) await waitForDeploy();

  const results = await Promise.all([
    checkPage('/'),
    checkPage('/admin/entitlements'),
    checkPage('/admin/diagnostics'),
    checkManifest('/data/vocab/manifest.json', 'vocab manifest', vocabManifestChecks, 13),
    checkManifest('/data/topics/manifest.json', 'topics manifest', topicManifestChecks, 19),
    checkApi('/api/entitlement', 401),
    checkApi('/api/admin/status', 401),
    checkApi('/api/admin/diagnostics/languages', 401),
    checkApi('/api/checkout', 401, true, { method: 'POST', body: '{}' }),
    checkApi('/api/paddle/webhook', 400, true, { method: 'POST', body: '{}' }),
  ]);

  const failed = results.filter((r) => !r.ok);
  console.log('');
  console.log(`Production health: ${failed.length === 0 ? 'PASS' : `FAIL (${failed.length}/${results.length} checks failed)`}`);
  for (const r of results) {
    if (r.ok) {
      console.log(`✓ ${r.route} ${r.actual}`);
    } else {
      console.log(`✗ ${r.route} — expected ${r.expected}, got ${r.actual}`);
    }
  }
  if (failed.length > 0) {
    console.log('');
    console.log(`Target: ${BASE}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(`Production health: FAIL`);
  console.error(`✗ ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
