'use client';

import { getAuthSnapshot } from '@/lib/authStore';
import { statsStorageKey } from '@/lib/auth/scopes';
import type { DayMap } from '@/lib/practiceStats';
import {
  MAX_BEST_SCORES,
  mergeProgress,
  pruneDays,
  sanitizeMergedProgress,
  type MergedProgress,
  type ProgressBestScores,
  type ProgressPayload,
} from './progress';

/**
 * Client half of learning-progress sync — rides the EXISTING Cloud Sync
 * round trip (/api/sync): the local snapshot is attached to every library
 * push and the server's merged truth is applied to the response. Progress
 * never becomes a second storage system: it lives in the same account-scoped
 * localStorage keys the app already uses.
 */

const RESET_KEY_BASE = 'audiorepeat-progress-reset-v1';
const BEST_KEY_BASE = 'audiorepeat-challenge-best-v1';

function resetStorageKey(uid: string | null | undefined): string {
  return uid ? `${RESET_KEY_BASE}:${uid}` : RESET_KEY_BASE;
}

/** SpeedChallenge's on-disk record shape (src/components/speed/SpeedChallenge.tsx). */
interface BestRecord {
  best: number;
  plays: number;
}

function readBestRecord(raw: string | null): BestRecord | null {
  if (raw === null) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<BestRecord> | number;
    if (typeof parsed === 'number') {
      return Number.isInteger(parsed) && parsed >= 0 ? { best: parsed, plays: 0 } : null;
    }
    if (parsed && typeof parsed.best === 'number' && Number.isFinite(parsed.best)) {
      return {
        best: Math.max(0, Math.floor(parsed.best)),
        plays: typeof parsed.plays === 'number' && Number.isFinite(parsed.plays)
          ? Math.max(0, Math.floor(parsed.plays))
          : 0,
      };
    }
  } catch {
    /* corrupted — ignore */
  }
  return null;
}

/**
 * Best-score keys for EXACTLY this scope. Signed-in accounts read
 * `...:<uid>:<setId>`; guests read only colon-free legacy keys so no other
 * account's records can ever leak into a payload.
 */
function scopedBestKeys(uid: string | null | undefined): { keys: string[]; bySetId: Map<string, string> } {
  const prefix = uid ? `${BEST_KEY_BASE}:${uid}:` : `${BEST_KEY_BASE}:`;
  const keys: string[] = [];
  const bySetId = new Map<string, string>();
  for (let i = 0; i < window.localStorage.length; i += 1) {
    const key = window.localStorage.key(i);
    if (!key || !key.startsWith(prefix)) continue;
    const rest = key.slice(prefix.length);
    if (!rest || rest.includes(':')) continue; // never another account's scope
    keys.push(key);
    bySetId.set(rest, key);
  }
  return { keys, bySetId };
}

export function loadLocalProgress(uid: string | null | undefined): {
  days: DayMap;
  bestScores: ProgressBestScores;
  resetAt: number;
} {
  if (typeof window === 'undefined') return { days: {}, bestScores: {}, resetAt: 0 };
  let days: DayMap = {};
  try {
    const raw = window.localStorage.getItem(statsStorageKey(uid));
    if (raw) {
      const parsed = JSON.parse(raw) as DayMap;
      if (parsed && typeof parsed === 'object') days = parsed;
    }
  } catch {
    /* corrupted — treat as empty */
  }
  const bestScores: ProgressBestScores = {};
  try {
    for (const [setId, key] of scopedBestKeys(uid).bySetId) {
      const record = readBestRecord(window.localStorage.getItem(key));
      if (record) bestScores[setId] = record.best;
    }
  } catch {
    /* ignore unreadable entries */
  }
  let resetAt = 0;
  try {
    resetAt = Number(window.localStorage.getItem(resetStorageKey(uid))) || 0;
  } catch {
    /* ignore */
  }
  return { days: pruneDays(days, Date.now(), resetAt), bestScores, resetAt };
}

/**
 * Persist merged truth into this account's local keys. Guarded against the
 * account-switch race: a response that arrives after the user signed out or
 * switched accounts is dropped instead of written into another session's
 * keys.
 */
export function storeLocalProgress(uid: string, progress: MergedProgress): boolean {
  if (typeof window === 'undefined') return false;
  if (getAuthSnapshot().user?.id !== uid) return false;
  try {
    window.localStorage.setItem(statsStorageKey(uid), JSON.stringify(progress.days));
    // Rewrite the account's best-score keys in SpeedChallenge's own JSON
    // shape, preserving the local play counts (plays are device-local).
    const { bySetId } = scopedBestKeys(uid);
    const prevRecords = new Map<string, BestRecord | null>();
    for (const [setId, key] of bySetId) prevRecords.set(setId, readBestRecord(window.localStorage.getItem(key)));
    for (const key of bySetId.values()) window.localStorage.removeItem(key);
    for (const [setId, score] of Object.entries(progress.bestScores)) {
      const record: BestRecord = { best: score, plays: prevRecords.get(setId)?.plays ?? 0 };
      window.localStorage.setItem(`${BEST_KEY_BASE}:${uid}:${setId}`, JSON.stringify(record));
    }
    window.localStorage.setItem(resetStorageKey(uid), String(progress.resetAt));
    return true;
  } catch {
    return false;
  }
}

/** Snapshot of the account's local progress as a sync payload. */
export function buildProgressPayload(
  uid: string | null | undefined,
  replace = false,
): ProgressPayload | null {
  if (!uid) return null;
  const local = loadLocalProgress(uid);
  return {
    days: local.days,
    bestScores: Object.fromEntries(Object.entries(local.bestScores).slice(0, MAX_BEST_SCORES)),
    resetAt: local.resetAt,
    replace,
  };
}

/**
 * Apply the server's merged progress for THIS account. Returns the merged
 * view only when it CHANGED and was stored locally (callers re-render);
 * null otherwise — invalid payload, storage failure, post-switch late
 * response, or an idempotent no-op (which also suppresses re-sync loops).
 */
export function applyMergedProgress(uid: string, body: unknown): MergedProgress | null {
  const remote = sanitizeMergedProgress(body);
  if (!remote) return null;
  const current = loadLocalProgress(uid);
  const next = mergeProgress(current, remote, Date.now());
  if (
    JSON.stringify(next.days) === JSON.stringify(current.days) &&
    JSON.stringify(next.bestScores) === JSON.stringify(current.bestScores) &&
    next.resetAt === current.resetAt
  ) {
    return null;
  }
  return storeLocalProgress(uid, next) ? next : null;
}
