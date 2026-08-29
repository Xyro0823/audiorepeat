import { getAuthIdToken } from '@/lib/authStore';

export interface GlobalLeaderboardEntry {
  rank: number;
  displayName: string;
  words: number;
  ms: number;
  isYou: boolean;
}

let pending: ReturnType<typeof setTimeout> | null = null;
let latest: { week: string; displayName: string; words: number; ms: number } | null = null;

async function request(path: string, init?: RequestInit): Promise<Response | null> {
  const token = await getAuthIdToken().catch(() => null);
  if (!token) return null;
  return fetch(path, { ...init, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(init?.headers ?? {}) } });
}

export function scheduleLeaderboardPublish(score: { week: string; displayName: string; words: number; ms: number }): void {
  if (score.words <= 0 && score.ms <= 0) return;
  latest = score;
  if (pending) clearTimeout(pending);
  pending = setTimeout(() => {
    const payload = latest;
    pending = null;
    latest = null;
    if (!payload) return;
    void publishGlobalLeaderboard(payload);
  }, 4_000);
}

export async function publishGlobalLeaderboard(score: { week: string; displayName: string; words: number; ms: number }): Promise<boolean> {
  if (score.words <= 0 && score.ms <= 0) return false;
  const response = await request('/api/leaderboard', { method: 'POST', body: JSON.stringify(score) });
  return Boolean(response?.ok);
}

export async function fetchGlobalLeaderboard(week: string): Promise<GlobalLeaderboardEntry[] | null> {
  const response = await request(`/api/leaderboard?week=${encodeURIComponent(week)}`);
  if (!response?.ok) return null;
  const data = await response.json().catch(() => null) as { entries?: unknown } | null;
  return Array.isArray(data?.entries) ? data.entries as GlobalLeaderboardEntry[] : null;
}
