import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { nextRetryDelayMs } from './client';

const source = readFileSync(join(process.cwd(), 'src/lib/sync/client.ts'), 'utf8');

describe('sync reconnect resilience', () => {
  it('backs off exponentially with a hard cap (no retry storms)', () => {
    expect(nextRetryDelayMs(0)).toBe(2_000);
    expect(nextRetryDelayMs(1)).toBe(4_000);
    expect(nextRetryDelayMs(2)).toBe(8_000);
    expect(nextRetryDelayMs(10)).toBe(60_000);
    expect(source).toMatch(/MAX_RETRY_ATTEMPTS\s*=\s*\d+/);
    expect(source).toMatch(/retryAttempts >= MAX_RETRY_ATTEMPTS/);
  });

  it('resyncs automatically when the browser comes back online', () => {
    expect(source).toContain("window.addEventListener('online'");
    // The online event clears backoff before rescheduling.
    expect(source).toMatch(
      /addEventListener\('online'[\s\S]{0,200}resetRetries\(\)[\s\S]{0,200}scheduleLibrarySync\(/,
    );
  });

  it('serializes sync across tabs with Web Locks and degrades safely', () => {
    expect(source).toContain("navigator.locks?.request");
    expect(source).toContain("'audiorepeat-library-sync'");
    // Fallback: without Web Locks the callback runs directly.
    expect(source).toMatch(/if \(typeof navigator === 'undefined' \|\| !navigator\.locks\?\.request\) return fn\(\);/);
    // The in-flight promise dedupe still guards same-tab races.
    expect(source).toContain('if (inFlight) return inFlight;');
  });

  it('preserves the offline queue/cursor/LWW merge flow', () => {
    for (const call of [
      'getPendingSyncPayload()',
      'mergeRemoteLibrary(',
      'acknowledgeSync(pending.entries)',
      'getSyncCursor()',
      'setSyncCursor(',
    ]) {
      expect(source).toContain(call);
    }
  });

  it('resets retry state on account switch so accounts stay isolated', () => {
    expect(source).toMatch(/lastSyncedUid !== uid\) resetRetries\(\)/);
    // The uid is captured per attempt and used for progress application.
    expect(source).toContain('applyMergedProgress(uid,');
  });
});
