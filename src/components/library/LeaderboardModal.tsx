'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePracticeStats } from '@/hooks/usePracticeStats';
import { dayByLang, dayKey } from '@/lib/practiceStats';
import { formatDuration } from '@/lib/format';
import { findLanguage } from '@/lib/languages';

const USERNAME_KEY = 'audiorepeat-username';
const MAX_USERNAME = 24;

function loadUsername(): string {
  if (typeof window === 'undefined') return 'You';
  try {
    return window.localStorage.getItem(USERNAME_KEY) ?? 'You';
  } catch {
    return 'You';
  }
}

function saveUsername(name: string): void {
  try {
    window.localStorage.setItem(USERNAME_KEY, name);
  } catch {
    /* storage unavailable */
  }
}

const MEDALS = ['🥇', '🥈', '🥉'];

interface Props {
  onClose: () => void;
}

export default function LeaderboardModal({ onClose }: Props) {
  const { days, streak, wordsToday, msToday } = usePracticeStats();
  const [username, setUsername] = useState(loadUsername);
  const [draft, setDraft] = useState(username);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const rows = useMemo(() => dayByLang(days, dayKey(new Date())), [days]);

  const commitUsername = () => {
    const clean = draft.trim().slice(0, MAX_USERNAME) || 'You';
    setUsername(clean);
    saveUsername(clean);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-night-950/80 p-4 backdrop-blur-sm">
      <div className="glass animate-fade-up max-h-[88vh] w-full max-w-md overflow-y-auto rounded-3xl p-6 text-center shadow-[0_0_60px_rgba(255,201,77,0.12)]">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">🏆 Daily Leaderboard</h2>
          <button
            onClick={onClose}
            aria-label="Close leaderboard"
            className="rounded-lg px-2 py-1 text-slate-400 transition hover:bg-white/5 hover:text-white"
          >
            ✕
          </button>
        </div>

        {/* Profile card — the only "user" in this offline app. */}
        <div className="mt-4 rounded-2xl border border-neon-amber/30 bg-gradient-to-br from-neon-amber/10 to-night-900 p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 text-left">
              <p className="truncate text-lg font-bold text-white">{username}</p>
              <p className="text-[11px] text-slate-400">
                🔥 {streak}-day streak · {wordsToday} words · {formatDuration(msToday)} today
              </p>
            </div>
            <span className="shrink-0 rounded-full border border-neon-amber/50 bg-neon-amber/15 px-3 py-1 text-xs font-bold text-neon-amber">
              Rank #1
            </span>
          </div>
          <div className="mt-3 flex gap-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={MAX_USERNAME}
              placeholder="Display name"
              aria-label="Display name"
              className="min-w-0 flex-1 rounded-xl border border-white/10 bg-night-800/80 px-3 py-2 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-neon-amber/60"
            />
            <button
              onClick={commitUsername}
              className="shrink-0 rounded-xl bg-gradient-to-r from-neon-amber to-neon-magenta px-4 py-2 text-sm font-semibold text-night-950 transition hover:brightness-110 active:scale-95"
            >
              {saved ? 'Saved ✓' : 'Save'}
            </button>
          </div>
        </div>

        {/* Ranked languages practiced today. */}
        <div className="mt-4 text-left">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
            Today by language
          </p>
          {rows.length === 0 ? (
            <div className="mt-2 rounded-2xl border border-dashed border-white/10 p-6 text-center">
              <p className="text-sm text-slate-400">No practice yet today</p>
              <p className="mt-1 text-xs text-slate-500">
                Press play on a set to start climbing the board.
              </p>
            </div>
          ) : (
            <div className="mt-2 space-y-1.5">
              {rows.map((row, i) => (
                <div
                  key={row.lang}
                  className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${
                    i === 0
                      ? 'border-neon-amber/40 bg-neon-amber/10'
                      : 'border-white/5 bg-white/[0.02]'
                  }`}
                >
                  <span className="w-7 text-center text-base">
                    {i < 3 ? MEDALS[i] : <span className="text-sm font-bold text-slate-500">{i + 1}</span>}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-200">
                    {findLanguage(row.lang)?.label ?? row.lang}
                  </span>
                  <span className="text-xs tabular-nums text-slate-400">{row.w} words</span>
                  <span className="w-14 text-right text-sm font-semibold tabular-nums text-neon-cyan">
                    {formatDuration(row.ms)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <p className="mt-4 text-[11px] leading-relaxed text-slate-600">
          AudioRepeat is offline-first with no server, so this board ranks your own daily
          practice by language. The layout is ready for a friends/global feed if a backend is
          ever added.
        </p>
      </div>
    </div>
  );
}
