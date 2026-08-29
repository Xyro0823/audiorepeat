import { NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { consumeDistributedRateLimit } from '@/lib/distributedRateLimit';
import { getAdminDb, isAdminConfigured, verifyIdToken } from '@/lib/firebase/admin';
import { NO_STORE_HEADERS } from '@/lib/http';

export const runtime = 'nodejs';

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;
const MAX_WORDS = 100_000;
const MAX_MS = 86_400_000;
const MAX_NAME = 24;

function tokenFrom(request: Request): string | null {
  const value = request.headers.get('authorization');
  return value?.startsWith('Bearer ') ? value.slice(7).trim() || null : null;
}

function publicName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const name = value.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, MAX_NAME);
  return name.length > 0 ? name : null;
}

function whole(value: unknown, limit: number): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= limit ? value : null;
}

async function authenticate(request: Request): Promise<string | null> {
  if (!isAdminConfigured()) return null;
  const token = tokenFrom(request);
  return token ? verifyIdToken(token) : null;
}

export async function GET(request: Request) {
  const uid = await authenticate(request);
  if (!isAdminConfigured()) return NextResponse.json({ error: 'server-not-configured' }, { status: 503, headers: NO_STORE_HEADERS });
  if (!uid) return NextResponse.json({ error: 'unauthenticated' }, { status: 401, headers: NO_STORE_HEADERS });
  const week = new URL(request.url).searchParams.get('week') ?? '';
  if (!DAY_KEY.test(week)) return NextResponse.json({ error: 'invalid-week' }, { status: 400, headers: NO_STORE_HEADERS });

  const snapshot = await getAdminDb()
    .collection(`leaderboard_weeks/${week}/entries`)
    .orderBy('words', 'desc')
    .limit(50)
    .get();
  const entries = snapshot.docs.map((doc) => {
    const data = doc.data() as { displayName?: unknown; words?: unknown; ms?: unknown };
    return {
      displayName: publicName(data.displayName) ?? 'Learner',
      words: whole(data.words, MAX_WORDS) ?? 0,
      ms: whole(data.ms, MAX_MS) ?? 0,
      isYou: doc.id === uid,
    };
  }).sort((a, b) => b.words - a.words || b.ms - a.ms).map((entry, index) => ({ ...entry, rank: index + 1 }));
  return NextResponse.json({ entries }, { headers: NO_STORE_HEADERS });
}

export async function POST(request: Request) {
  const uid = await authenticate(request);
  if (!isAdminConfigured()) return NextResponse.json({ error: 'server-not-configured' }, { status: 503, headers: NO_STORE_HEADERS });
  if (!uid) return NextResponse.json({ error: 'unauthenticated' }, { status: 401, headers: NO_STORE_HEADERS });
  if (await consumeDistributedRateLimit({ key: `leaderboard:${uid}`, limit: 30, windowMs: 10 * 60_000 }) === 'limited') {
    return NextResponse.json({ error: 'rate-limited' }, { status: 429, headers: NO_STORE_HEADERS });
  }
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const week = body?.week;
  const displayName = publicName(body?.displayName);
  const words = whole(body?.words, MAX_WORDS);
  const ms = whole(body?.ms, MAX_MS);
  if (typeof week !== 'string' || !DAY_KEY.test(week) || !displayName || words === null || ms === null || (words === 0 && ms === 0)) {
    return NextResponse.json({ error: 'invalid-body' }, { status: 400, headers: NO_STORE_HEADERS });
  }
  await getAdminDb().doc(`leaderboard_weeks/${week}/entries/${uid}`).set({ displayName, words, ms, updatedAt: Timestamp.now() }, { merge: true });
  return NextResponse.json({ published: true }, { headers: NO_STORE_HEADERS });
}
