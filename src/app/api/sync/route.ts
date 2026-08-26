import { NextResponse } from 'next/server';
import type { DocumentReference } from 'firebase-admin/firestore';
import { getAdminDb, isAdminConfigured, verifyIdToken } from '@/lib/firebase/admin';
import { consumeDistributedRateLimit } from '@/lib/distributedRateLimit';
import { NO_STORE_HEADERS } from '@/lib/http';
import {
  MAX_SYNC_BODY_BYTES,
  MAX_SYNC_RECORDS,
  MAX_SYNC_SETS,
  MAX_TOTAL_SYNC_WORDS,
  nextServerSyncCursor,
  newerLibraryRecord,
  sanitizeSyncPayload,
  sanitizeSyncSet,
  sanitizeTombstone,
  transitionLibraryQuota,
} from '@/lib/sync/librarySync';
import {
  mergeProgress,
  replaceWithProgress,
  sanitizeMergedProgress,
  sanitizeProgressPayload,
  type MergedProgress,
} from '@/lib/sync/progress';

export const runtime = 'nodejs';

function bearerToken(request: Request): string | null {
  const value = request.headers.get('authorization');
  return value?.startsWith('Bearer ') ? value.slice(7).trim() || null : null;
}

/**
 * Authenticated, bidirectional last-write-wins library sync. Identity comes
 * exclusively from the verified Firebase token; a client-supplied uid is
 * never accepted. Each set is an independent Firestore document, avoiding
 * the 1 MiB single-document limit for larger libraries.
 */
export async function POST(request: Request) {
  if (!isAdminConfigured()) {
    return NextResponse.json({ error: 'sync-not-configured' }, { status: 503, headers: NO_STORE_HEADERS });
  }
  const token = bearerToken(request);
  const uid = token ? await verifyIdToken(token) : null;
  if (!uid) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401, headers: NO_STORE_HEADERS });
  }
  const declared = Number(request.headers.get('content-length') ?? 0);
  if (declared > MAX_SYNC_BODY_BYTES) {
    return NextResponse.json({ error: 'body-too-large' }, { status: 413, headers: NO_STORE_HEADERS });
  }
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > MAX_SYNC_BODY_BYTES) {
    return NextResponse.json({ error: 'body-too-large' }, { status: 413, headers: NO_STORE_HEADERS });
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: 'invalid-input' }, { status: 400, headers: NO_STORE_HEADERS });
  }
  const payload = sanitizeSyncPayload(raw);
  if (!payload) {
    return NextResponse.json({ error: 'invalid-input' }, { status: 400, headers: NO_STORE_HEADERS });
  }
  // Optional learning-progress snapshot riding the same round trip. Identity
  // is the verified token uid — the client never names an account.
  const progressInput = (raw as { progress?: unknown }).progress;
  const progress = progressInput === undefined ? null : sanitizeProgressPayload(progressInput);
  if (progressInput !== undefined && !progress) {
    return NextResponse.json({ error: 'invalid-input' }, { status: 400, headers: NO_STORE_HEADERS });
  }
  const allowed = await consumeDistributedRateLimit({
    key: `library-sync:${uid}`,
    limit: 60,
    windowMs: 10 * 60_000,
  });
  if (allowed === 'limited') {
    return NextResponse.json(
      { error: 'rate-limited' },
      { status: 429, headers: { ...NO_STORE_HEADERS, 'Retry-After': '600' } },
    );
  }

  try {
    const db = getAdminDb();
    const collection = db.collection(`users/${uid}/sets`);
    const metaRef = db.doc(`users/${uid}/sync/library`);
    let mergedProgress: MergedProgress | null = null;
    let syncCursor = 0;
    await db.runTransaction(async (tx) => {
      const metaSnap = await tx.get(metaRef);
      const incoming = [
        ...payload.sets.map((set) => ({ id: set.id, kind: 'set' as const, set })),
        ...payload.tombstones.map((entry) => ({ id: entry.id, kind: 'deleted' as const, entry })),
      ];
      const snapshots = await Promise.all(incoming.map((item) => tx.get(collection.doc(item.id))));
      // Firestore transactions require every read to finish before the first
      // write. Progress shares this transaction with library records, so load
      // it here rather than after the set/meta writes below.
      const progressRef = progress ? db.doc(`users/${uid}/sync/progress`) : null;
      const progressSnap = progressRef ? await tx.get(progressRef) : null;
      let activeCount = 0;
      let wordCount = 0;
      let recordCount = 0;
      if (metaSnap.exists) {
        const meta = metaSnap.data() as {
          activeCount?: number;
          wordCount?: number;
          recordCount?: number;
          syncCursor?: number;
        };
        activeCount = typeof meta.activeCount === 'number' ? meta.activeCount : 0;
        wordCount = typeof meta.wordCount === 'number' ? meta.wordCount : 0;
        recordCount = typeof meta.recordCount === 'number' ? meta.recordCount : 0;
        syncCursor = nextServerSyncCursor(
          typeof meta.syncCursor === 'number' && Number.isFinite(meta.syncCursor) ? meta.syncCursor : 0,
        );
      } else {
        const existing = await tx.get(collection);
        recordCount = existing.size;
        for (const doc of existing.docs) {
          const data = doc.data() as { kind?: string; data?: { words?: unknown[] } };
          if (data.kind === 'set') {
            activeCount += 1;
            wordCount += Array.isArray(data.data?.words) ? data.data.words.length : 0;
          }
        }
        syncCursor = nextServerSyncCursor(0);
      }

      const writes: Array<{ ref: DocumentReference; data: Record<string, unknown> }> = [];
      incoming.forEach((item, index) => {
        const current = snapshots[index].data() as {
          kind?: string;
          updatedAt?: number;
          deletedAt?: number;
          data?: { words?: unknown[] };
        } | undefined;
        const incomingClock = item.kind === 'set'
          ? { updatedAt: item.set.updatedAt }
          : { deletedAt: item.entry.deletedAt };
        if (!newerLibraryRecord(current, incomingClock)) return;
        const nextCounts = transitionLibraryQuota(
          { activeCount, wordCount, recordCount },
          current
            ? {
                kind: current.kind,
                wordCount: current.kind === 'set' && Array.isArray(current.data?.words)
                  ? current.data.words.length
                  : 0,
              }
            : undefined,
          item.kind === 'set'
            ? { kind: 'set', wordCount: item.set.words.length }
            : { kind: 'deleted' },
        );
        ({ activeCount, wordCount, recordCount } = nextCounts);
        writes.push({
          ref: collection.doc(item.id),
          data: item.kind === 'set'
            ? { kind: 'set', data: item.set, updatedAt: item.set.updatedAt, syncedAt: syncCursor }
            : { kind: 'deleted', deletedAt: item.entry.deletedAt, syncedAt: syncCursor },
        });
      });
      if (
        activeCount > MAX_SYNC_SETS ||
        wordCount > MAX_TOTAL_SYNC_WORDS ||
        recordCount > MAX_SYNC_RECORDS
      ) throw new Error('library-sync-quota');
      for (const write of writes) tx.set(write.ref, write.data);
      tx.set(metaRef, { activeCount, wordCount, recordCount, syncCursor, updatedAt: Date.now() });

      // Learning progress: transactional max-merge into the account's single
      // progress doc. Schema/quota validation already happened in the
      // sanitizer; prune + reset markers are applied inside the merge so a
      // stats reset or restore cannot resurrect from stored history.
      if (progress) {
        const now = Date.now();
        const stored = sanitizeMergedProgress(progressSnap?.data()) ?? {
          days: {},
          bestScores: {},
          resetAt: 0,
        };
        mergedProgress = progress.replace
          ? replaceWithProgress(progress, now)
          : mergeProgress(stored, { ...progress }, now);
        tx.set(progressRef!, { ...mergedProgress, syncedAt: now });
      }
    });

    // `syncCursor` is allocated in the same transaction as the writes. Only
    // return records through that fixed fence: a later commit gets a strictly
    // larger cursor and will be included on the next pull instead of being
    // silently skipped between this query and the response.
    const snapshot = await collection
      .where('syncedAt', '>', payload.since)
      .where('syncedAt', '<=', syncCursor)
      .get();
    const sets = [];
    const tombstones = [];
    for (const doc of snapshot.docs) {
      const data = doc.data() as { kind?: string; data?: unknown; deletedAt?: unknown };
      if (data.kind === 'set') {
        const set = sanitizeSyncSet(data.data);
        if (set) sets.push(set);
      } else if (data.kind === 'deleted') {
        const entry = sanitizeTombstone({ id: doc.id, deletedAt: data.deletedAt });
        if (entry) tombstones.push(entry);
      }
    }
    return NextResponse.json(
      {
        sets,
        tombstones,
        syncedAt: syncCursor,
        ...(mergedProgress ? { progress: mergedProgress } : {}),
      },
      { headers: NO_STORE_HEADERS },
    );
  } catch (error) {
    if (error instanceof Error && error.message === 'library-sync-quota') {
      return NextResponse.json({ error: 'library-limit' }, { status: 413, headers: NO_STORE_HEADERS });
    }
    console.error('[library-sync] failed', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'sync-failed' }, { status: 500, headers: NO_STORE_HEADERS });
  }
}
