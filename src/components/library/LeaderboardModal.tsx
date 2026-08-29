'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { usePracticeStats } from '@/hooks/usePracticeStats';
import useDialogA11y from '@/hooks/useDialogA11y';
import { dayByLang, dayKey, lastNDays, weekKey } from '@/lib/practiceStats';
import { formatDuration } from '@/lib/format';
import { findLanguage } from '@/lib/languages';
import { usernameStorageKey } from '@/lib/auth/scopes';
import { useT } from '@/lib/i18n';
import { fetchGlobalLeaderboard, publishGlobalLeaderboard, type GlobalLeaderboardEntry } from '@/lib/leaderboard/client';

const MAX_USERNAME = 24;

function loadUsername(key: string): string {
  if (typeof window === 'undefined') return 'You';
  try {
    return window.localStorage.getItem(key) ?? 'You';
  } catch {
    return 'You';
  }
}

function saveUsername(key: string, name: string): void {
  try {
    window.localStorage.setItem(key, name);
  } catch {
    /* storage unavailable */
  }
}

const MEDALS = ['🥇', '🥈', '🥉'];

interface Props {
  onClose: () => void;
}

export default function LeaderboardModal({ onClose }: Props) {
  const t = useT();
  const { days, streak, wordsToday, msToday } = usePracticeStats();
  // Signed-in users are identified by their account name (read-only here);
  // guests keep an editable nickname.
  const { user } = useAuth();
  const isAccount = user !== null;
  const [username, setUsername] = useState(() =>
    user ? user.username : loadUsername(usernameStorageKey(null)),
  );
  const [draft, setDraft] = useState(username);
  const [saved, setSaved] = useState(false);
  const [globalRows, setGlobalRows] = useState<GlobalLeaderboardEntry[] | null>(null);
  const [globalLoading, setGlobalLoading] = useState(Boolean(user));
  const dialogRef = useDialogA11y<HTMLDivElement>(true, onClose);
  const week = weekKey(new Date());

  const rows = useMemo(() => dayByLang(days, dayKey(new Date())), [days]);
  const weeklyTotals = useMemo(
    () => lastNDays(days, 7).reduce((total, day) => ({ words: total.words + day.words, ms: total.ms + day.ms }), { words: 0, ms: 0 }),
    [days],
  );

  const commitUsername = () => {
    const clean = draft.trim().slice(0, MAX_USERNAME) || 'You';
    setUsername(clean);
    saveUsername(usernameStorageKey(user?.id), clean);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1500);
  };

  useEffect(() => {
    if (!user) return;
    let active = true;
    const load = async () => {
      setGlobalLoading(true);
      if (weeklyTotals.words > 0 || weeklyTotals.ms > 0) {
        await publishGlobalLeaderboard({ week, displayName: user.username, words: weeklyTotals.words, ms: weeklyTotals.ms });
      }
      const rows = await fetchGlobalLeaderboard(week);
      if (active) {
        setGlobalRows(rows);
        setGlobalLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [user, week, weeklyTotals.words, weeklyTotals.ms]);

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={t('library.leaderboard.title')}
      className="fixed inset-0 z-50 flex items-center justify-center bg-night-950/80 p-4 backdrop-blur-sm"
    >
      <div className="glass animate-fade-up max-h-[88vh] w-full max-w-md overflow-y-auto rounded-3xl p-6 text-center shadow-[0_0_60px_rgba(255,201,77,0.12)]">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">{t('library.leaderboard.title')}</h2>
          <button
            onClick={onClose}
            aria-label={t('library.leaderboard.closeAria')}
            className="flex h-11 w-11 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan"
          >
            ✕
          </button>
        </div>

        {/* Profile card — the "user" in this offline app. */}
        <div className="mt-4 rounded-2xl border border-neon-amber/30 bg-gradient-to-br from-neon-amber/10 to-night-900 p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 text-left">
              <p className="truncate text-lg font-bold text-white">{username}</p>
              <p className="text-[11px] text-slate-400">
                {t('library.leaderboard.todayStats', {
                  streak,
                  words: wordsToday,
                  time: formatDuration(msToday),
                })}
              </p>
            </div>
            <span className="shrink-0 rounded-full border border-neon-amber/50 bg-neon-amber/15 px-3 py-1 text-xs font-bold text-neon-amber">
              {globalRows?.find((row) => row.isYou)?.rank ? `#${globalRows.find((row) => row.isYou)?.rank}` : t('library.leaderboard.rankBadge')}
            </span>
          </div>
          {isAccount ? (
            <p className="mt-3 rounded-xl border border-white/10 bg-night-800/60 px-3 py-2 text-left text-[11px] text-slate-400">
              {t('library.leaderboard.accountNamePrefix')}{' '}
              <span className="font-semibold text-white">@{username}</span>{' '}
              {t('library.leaderboard.accountNameSuffix')}
            </p>
          ) : (
            <div className="mt-3 flex gap-2">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                maxLength={MAX_USERNAME}
                placeholder={t('library.leaderboard.displayName')}
                aria-label={t('library.leaderboard.displayName')}
                className="min-w-0 flex-1 rounded-xl border border-white/10 bg-night-800/80 px-3 py-2 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-neon-amber/60"
              />
              <button
                onClick={commitUsername}
                className="shrink-0 rounded-xl bg-gradient-to-r from-neon-amber to-neon-magenta px-4 py-2 text-sm font-semibold text-night-950 transition hover:brightness-110 active:scale-95"
              >
                {saved ? t('library.leaderboard.savedCheck') : t('common.save')}
              </button>
            </div>
          )}
        </div>

        {/* Global users who opted in by signing in; guest view keeps the local language breakdown. */}
        <div className="mt-4 text-left">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
            {isAccount ? 'Энэ долоо хоногийн дэлхийн эрэмбэ' : t('library.leaderboard.todayByLanguage')}
          </p>
          {isAccount && globalLoading ? (
            <div className="mt-2 rounded-2xl border border-white/10 p-6 text-center text-sm text-slate-400">Ачаалж байна…</div>
          ) : isAccount && globalRows ? (
            globalRows.length === 0 ? <div className="mt-2 rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-slate-400">Одоогоор нийтлэгдсэн амжилт алга.</div> :
            <div className="mt-2 space-y-1.5">{globalRows.map((row) => (
              <div key={`${row.rank}-${row.displayName}`} className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${row.isYou ? 'border-neon-amber/40 bg-neon-amber/10' : 'border-white/5 bg-white/[0.02]'}`}>
                <span className="w-7 text-center text-base">{row.rank <= 3 ? MEDALS[row.rank - 1] : <span className="text-sm font-bold text-slate-500">{row.rank}</span>}</span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-200">{row.displayName}{row.isYou ? ' (Та)' : ''}</span>
                <span className="text-xs tabular-nums text-slate-400">{t('library.leaderboard.rowWords', { count: row.words })}</span>
                <span className="w-14 text-right text-sm font-semibold tabular-nums text-neon-cyan">{formatDuration(row.ms)}</span>
              </div>
            ))}</div>
          ) : rows.length === 0 ? (
            <div className="mt-2 rounded-2xl border border-dashed border-white/10 p-6 text-center">
              <p className="text-sm text-slate-400">{t('library.leaderboard.emptyTitle')}</p>
              <p className="mt-1 text-xs text-slate-500">
                {t('library.leaderboard.emptyBody')}
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
                  <span className="text-xs tabular-nums text-slate-400">{t('library.leaderboard.rowWords', { count: row.w })}</span>
                  <span className="w-14 text-right text-sm font-semibold tabular-nums text-neon-cyan">
                    {formatDuration(row.ms)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <p className="mt-4 text-[11px] leading-relaxed text-slate-600">
          {t('library.leaderboard.footerNote')}
        </p>
      </div>
    </div>
  );
}
