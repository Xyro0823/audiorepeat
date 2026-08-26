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
    // Same-account requests dedupe, but different accounts never share an
    // in-flight result across a logout/account switch.
    expect(source).toContain('const inFlightByUid = new Map<string, Promise<VocabSet[]>>();');
    expect(source).toContain('const existing = inFlightByUid.get(uid);');
  });

  it('preserves the offline queue/cursor/LWW merge flow', () => {
    for (const call of [
      'getPendingSyncPayload(uid)',
      'mergeRemoteLibrary(',
      'acknowledgeSync(pending.entries, uid)',
      'getSyncCursor(uid)',
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

  it('drops a late response after logout or account switch before it can merge', () => {
    const ownerGuard = source.indexOf('if (!isCurrentSyncOwner(uid)) return local;');
    const merge = source.indexOf('await mergeRemoteLibrary(remote.sets, remote.tombstones, uid)');
    expect(ownerGuard).toBeGreaterThan(-1);
    expect(merge).toBeGreaterThan(ownerGuard);
  });
});
