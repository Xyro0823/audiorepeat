import { describe, expect, it } from 'vitest';
import {
  cacheControlHasNoStore,
  parseJsonBody,
  retry,
  sleep,
  statusIs,
  topicManifestChecks,
  vocabManifestChecks,
  withTimeout,
} from '@/lib/productionHealth';

describe('statusIs', () => {
  it('accepts an exact expected status', () => {
    expect(statusIs(200, 200)).toBe(true);
    expect(statusIs(401, 200)).toBe(false);
    expect(statusIs(500, 200)).toBe(false);
  });

  it('accepts any status in an expected list', () => {
    expect(statusIs(204, [200, 204])).toBe(true);
    expect(statusIs(404, [200, 204])).toBe(false);
  });
});

describe('parseJsonBody', () => {
  it('parses valid JSON objects', () => {
    const result = parseJsonBody('{"a": 1}');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual({ a: 1 });
  });

  it('parses valid JSON arrays (validity only; structure checked separately)', () => {
    const result = parseJsonBody('[1, 2, 3]');
    expect(result.ok).toBe(true);
  });

  it('rejects malformed JSON with a readable error', () => {
    const result = parseJsonBody('not json {');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.length).toBeGreaterThan(0);
  });

  it('rejects empty bodies', () => {
    expect(parseJsonBody('').ok).toBe(false);
    expect(parseJsonBody('   ').ok).toBe(false);
  });
});

describe('cacheControlHasNoStore', () => {
  it('matches a bare no-store directive', () => {
    expect(cacheControlHasNoStore('no-store')).toBe(true);
  });

  it('matches no-store among other directives regardless of order', () => {
    expect(cacheControlHasNoStore('public, max-age=0, no-store')).toBe(true);
    expect(cacheControlHasNoStore('no-store, private')).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(cacheControlHasNoStore('NO-STORE')).toBe(true);
    expect(cacheControlHasNoStore('Public, Max-Age=60, No-Store')).toBe(true);
  });

  it('rejects headers without no-store and missing headers', () => {
    expect(cacheControlHasNoStore('public, max-age=60')).toBe(false);
    expect(cacheControlHasNoStore('max-age=0, private')).toBe(false);
    expect(cacheControlHasNoStore(null)).toBe(false);
    expect(cacheControlHasNoStore(undefined)).toBe(false);
  });
});

describe('vocabManifestChecks', () => {
  const valid = () => ({
    ar: { A1: 258, A2: 255, B1: 301, B2: 378, C1: 311, C2: 816 },
    es: { A1: 1, A2: 1 },
  });

  it('accepts a well-formed language manifest', () => {
    expect(vocabManifestChecks(valid(), 2)).toEqual({ ok: true, problems: [] });
  });

  it('fails non-object manifests', () => {
    expect(vocabManifestChecks(null).ok).toBe(false);
    expect(vocabManifestChecks([]).ok).toBe(false);
    expect(vocabManifestChecks('nope').ok).toBe(false);
  });

  it('fails when fewer languages than the minimum are present', () => {
    const result = vocabManifestChecks(valid(), 5);
    expect(result.ok).toBe(false);
    expect(result.problems.some((p) => p.includes('expected >= 5 languages'))).toBe(true);
  });

  it('fails when a language entry is malformed', () => {
    expect(vocabManifestChecks({ ar: { A1: 1 }, es: 'broken' }, 2).ok).toBe(false);
    expect(vocabManifestChecks({ ar: { A1: 1 }, es: {} }, 2).ok).toBe(false);
  });
});

describe('topicManifestChecks', () => {
  const valid = () => ({
    animals: { label: 'Animals & Pets', emoji: '🐾', langs: { es: 40, fr: 40 } },
    food: { label: 'Food & Drink', emoji: '🍜', langs: { es: 40 } },
  });

  it('accepts a well-formed topic manifest', () => {
    expect(topicManifestChecks(valid(), 2)).toEqual({ ok: true, problems: [] });
  });

  it('fails non-object manifests', () => {
    expect(topicManifestChecks(42).ok).toBe(false);
    expect(topicManifestChecks({}).ok).toBe(false);
  });

  it('fails when fewer topics than the minimum are present', () => {
    const result = topicManifestChecks(valid(), 3);
    expect(result.ok).toBe(false);
    expect(result.problems.some((p) => p.includes('expected >= 3 topics'))).toBe(true);
  });

  it('fails when a topic entry lacks a label or langs', () => {
    expect(topicManifestChecks({ animals: { label: 'x', langs: {} }, food: { emoji: '🍜', langs: {} } }, 2).ok).toBe(false);
    expect(topicManifestChecks({ animals: { label: 'x', langs: {} }, food: { label: 'y' } }, 2).ok).toBe(false);
  });
});

describe('withTimeout', () => {
  it('resolves when the promise settles in time', async () => {
    await expect(withTimeout(Promise.resolve('ok'), 1_000, 'test')).resolves.toBe('ok');
  });

  it('rejects with a readable timeout error when the promise hangs', async () => {
    const hang = sleep(5_000);
    await expect(withTimeout(hang, 10, 'test')).rejects.toThrow('test timed out after 10ms');
  });

  it('still resolves the value when racing is close to the deadline', async () => {
    await expect(withTimeout(sleep(5).then(() => 'slow'), 1_000, 'test')).resolves.toBe('slow');
  });
});

describe('retry', () => {
  it('succeeds on the first attempt without retrying', async () => {
    let calls = 0;
    const result = await retry(async () => {
      calls += 1;
      return 'first-try';
    }, { attempts: 3, baseDelayMs: 1 });
    expect(result).toBe('first-try');
    expect(calls).toBe(1);
  });

  it('retries after failures and succeeds', async () => {
    let calls = 0;
    const result = await retry(async () => {
      calls += 1;
      if (calls < 3) throw new Error('transient');
      return 'recovered';
    }, { attempts: 3, baseDelayMs: 1 });
    expect(result).toBe('recovered');
    expect(calls).toBe(3);
  });

  it('gives up after exhausting attempts and rejects with the last error', async () => {
    let calls = 0;
    await expect(
      retry(async () => {
        calls += 1;
        throw new Error(`failure ${calls}`);
      }, { attempts: 3, baseDelayMs: 1 }),
    ).rejects.toThrow('failure 3');
    expect(calls).toBe(3);
  });

  it('supports a single-attempt retry policy', async () => {
    let calls = 0;
    await expect(
      retry(async () => {
        calls += 1;
        throw new Error('nope');
      }, { attempts: 1, baseDelayMs: 1 }),
    ).rejects.toThrow('nope');
    expect(calls).toBe(1);
  });
});
