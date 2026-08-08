'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ActivityHeatmap from '@/components/ActivityHeatmap';
import StreakBadge from '@/components/StreakBadge';
import { usePracticeStats } from '@/hooks/usePracticeStats';
import { useLists } from '@/hooks/useLists';
import { formatDuration } from '@/lib/format';
import { findLanguage, LANGUAGES } from '@/lib/languages';
import { decodeSetFromUrl, shareUrlForSet } from '@/lib/sets/share';
import { downloadSet, parseSetJson } from '@/lib/sets/io';
import type { VocabSet } from '@/types/app';
import CefrBadge from './CefrBadge';
import LanguageBadge from '@/components/LanguageBadge';
import LeaderboardModal from './LeaderboardModal';
import NewSetButton from './NewSetButton';
import ProfileDropdown from '@/components/auth/ProfileDropdown';
import SetEditor from './SetEditor';
import SettingsButton from '@/components/settings/SettingsButton';
import SpeedChallenge from '../speed/SpeedChallenge';
import StarterLibraryModal from './StarterLibraryModal';
import SubtitleImportModal from './SubtitleImportModal';
import InstallAppButton from '@/components/pwa/InstallAppButton';

function Logo() {
  return (
    <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04]">
      <svg viewBox="0 0 24 24" className="h-4 w-4 text-neon-violet" fill="currentColor">
        <path d="M8 5.5v13a1 1 0 0 0 1.5.87l11-6.5a1 1 0 0 0 0-1.74l-11-6.5A1 1 0 0 0 8 5.5Z" />
      </svg>
    </div>
  );
}

function languageLabel(code: string): string {
  return findLanguage(code)?.label ?? code;
}

interface SetCardProps {
  set: VocabSet;
  index: number;
  onPlay: () => void;
  onChallenge: () => void;
  onEdit: () => void;
  onExport: () => void;
  onShare: () => void;
  onDelete: () => void;
}

function SetCard({ set, index, onPlay, onChallenge, onEdit, onExport, onShare, onDelete }: SetCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const rootRef = useRef<HTMLElement | null>(null);

  const total = set.words.length;
  const mastered = set.words.filter((w) => w.mastery === 'mastered').length;
  const hard = set.words.filter((w) => w.mastery === 'hard').length;
  const pct = total > 0 ? Math.round((mastered / total) * 100) : 0;

  // Close the menu on outside click.
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [menuOpen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const run = (fn: () => void) => () => {
    setMenuOpen(false);
    setConfirmDelete(false);
    fn();
  };

  const menuItem = 'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition';

  return (
    <article
      ref={rootRef}
      className={`glass-card animate-fade-up relative rounded-2xl p-5 ${
        menuOpen ? 'z-40 border-white/25' : ''
      }`}
      style={{ animationDelay: `${Math.min(index * 60, 600)}ms` }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-[15px] font-semibold tracking-tight text-white">
              {set.name}
            </h3>
            <LanguageBadge lang={set.lang} label={languageLabel(set.lang)} />
          </div>
          {/* Pill badge: level + descriptive label */}
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            {set.cefr && <CefrBadge level={set.cefr} />}
          </div>
        </div>

        {/* Three-dots actions menu */}
        <div className="relative shrink-0">
          <button
            onClick={() => {
              setMenuOpen((o) => !o);
              setConfirmDelete(false);
            }}
            aria-label={`Actions for ${set.name}`}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            className="btn-clean flex h-8 w-8 items-center justify-center rounded-lg text-slate-400"
          >
            <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="currentColor" aria-hidden="true">
              <circle cx="5" cy="12" r="1.6" />
              <circle cx="12" cy="12" r="1.6" />
              <circle cx="19" cy="12" r="1.6" />
            </svg>
          </button>

          {menuOpen && (
            <div
              role="menu"
              aria-label={`Actions for ${set.name}`}
              className="glass animate-fade-up absolute right-0 top-9 z-30 w-48 rounded-xl p-1.5 shadow-[0_20px_60px_rgba(0,0,0,0.6)]"
            >
              <button
                role="menuitem"
                className={`${menuItem} text-neon-amber hover:bg-neon-amber/10`}
                onClick={run(onChallenge)}
              >
                <span aria-hidden>⚡</span> 1-Min challenge
              </button>
              <button
                role="menuitem"
                className={`${menuItem} text-slate-300 hover:bg-white/5 hover:text-white`}
                onClick={run(onEdit)}
              >
                <span aria-hidden>✏️</span> Edit
              </button>
              <button
                role="menuitem"
                className={`${menuItem} text-slate-300 hover:bg-white/5 hover:text-white`}
                onClick={run(onExport)}
              >
                <span aria-hidden>⬇</span> Download JSON
              </button>
              {!set.id.startsWith('seed-') && (
                <button
                  role="menuitem"
                  className={`${menuItem} text-slate-300 hover:bg-white/5 hover:text-white`}
                  onClick={run(onShare)}
                >
                  <span aria-hidden>🔗</span> Copy share link
                </button>
              )}
              <div className="my-1 h-px bg-white/10" />
              {confirmDelete ? (
                <div className="rounded-lg bg-neon-magenta/10 p-1">
                  <button
                    role="menuitem"
                    className={`${menuItem} text-neon-magenta hover:bg-neon-magenta/10`}
                    onClick={run(onDelete)}
                  >
                    <span aria-hidden>🗑</span> Confirm delete
                  </button>
                  <button
                    role="menuitem"
                    className={`${menuItem} text-slate-300 hover:bg-white/5 hover:text-white`}
                    onClick={() => setConfirmDelete(false)}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  role="menuitem"
                  className={`${menuItem} text-neon-magenta hover:bg-neon-magenta/10`}
                  onClick={() => setConfirmDelete(true)}
                >
                  <span aria-hidden>🗑</span> Delete
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Clean meta + minimal progress */}
      <div className="mt-4">
        <p className="truncate text-xs text-slate-500">
          {set.words.length} words · {languageLabel(set.lang)} → {languageLabel(set.nativeLang)}
          {set.settings ? ' · custom settings' : ''}
        </p>
        <div className="mt-2.5 flex items-center justify-between text-[11px]">
          <span className="font-medium text-slate-500">{pct}% mastered</span>
          {hard > 0 && <span className="text-neon-amber">{hard} to review</span>}
        </div>
        <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-white/[0.06]">
          <div
            className="h-full rounded-full bg-neon-violet transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Elegant actions: Play (primary glow) + 1-Min (quiet) */}
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          onClick={onPlay}
          className="btn-primary flex h-9 items-center justify-center gap-1.5 rounded-lg text-[13px] font-semibold text-white"
        >
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
            <path d="M8 5.5v13a1 1 0 0 0 1.5.87l11-6.5a1 1 0 0 0 0-1.74l-11-6.5A1 1 0 0 0 8 5.5Z" />
          </svg>
          Play
        </button>
        <button
          onClick={onChallenge}
          title="1-Minute speed challenge"
          className="btn-clean flex h-9 items-center justify-center gap-1.5 rounded-lg text-[13px] font-medium text-slate-300"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-3.5 w-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="13" r="8" />
            <path d="M12 9v4l2.5 2.5M9 2h6" />
          </svg>
          1-Min
        </button>
      </div>
    </article>
  );
}

type ImportMsg = { kind: 'ok' | 'err'; text: string } | null;

export default function SetLibrary() {
  const { sets, loading, saveSet, removeSet } = useLists();
  const { wordsToday, msToday, streak, week, recordWords } = usePracticeStats();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const subtitleInputRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState<VocabSet | 'new' | null>(null);
  const [browse, setBrowse] = useState(false);
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const [subtitleImport, setSubtitleImport] = useState<{ fileName: string; text: string } | null>(
    null,
  );
  const [challengeSet, setChallengeSet] = useState<VocabSet | null>(null);
  const [importMsg, setImportMsg] = useState<ImportMsg>(null);
  const [pendingImport, setPendingImport] = useState<VocabSet | null>(null);

  const flash = useCallback((msg: ImportMsg) => {
    setImportMsg(msg);
    if (msg) window.setTimeout(() => setImportMsg((m) => (m === msg ? null : m)), 4000);
  }, []);

  const handleImportFile = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = parseSetJson(text);
      if (!parsed) {
        flash({ kind: 'err', text: 'That file is not a valid AudioRepeat set.' });
        return;
      }
      await saveSet(parsed);
      flash({ kind: 'ok', text: `Imported "${parsed.name}" (${parsed.words.length} words).` });
    } catch {
      flash({ kind: 'err', text: 'Could not read that file.' });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSubtitleFile = async (file: File) => {
    try {
      const text = await file.text();
      setSubtitleImport({ fileName: file.name, text });
    } catch {
      flash({ kind: 'err', text: 'Could not read that subtitle file.' });
    } finally {
      if (subtitleInputRef.current) subtitleInputRef.current.value = '';
    }
  };

  // Default subtitle language: the language the user studies most, else Spanish.
  const defaultSubtitleLang = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of sets) counts.set(s.lang, (counts.get(s.lang) ?? 0) + 1);
    let best = 'es-ES';
    let bestCount = 0;
    for (const [lang, count] of counts) {
      if (count > bestCount) {
        best = lang;
        bestCount = count;
      }
    }
    return best;
  }, [sets]);

  // The hero's "Browse Library" button dispatches this event to open the
  // starter library modal (the hero lives above this component).
  useEffect(() => {
    const onOpenBrowse = () => setBrowse(true);
    window.addEventListener('audiorepeat:open-browse', onOpenBrowse);
    return () => window.removeEventListener('audiorepeat:open-browse', onOpenBrowse);
  }, []);

  // Handle a shared-deck link: /?set=<encoded>. Decoded once on mount, then
  // imported as soon as the library has loaded (so duplicates can be spotted).
  useEffect(() => {
    try {
      const encoded = new URLSearchParams(window.location.search).get('set');
      if (!encoded) return;
      const parsed = decodeSetFromUrl(encoded);
      if (parsed) queueMicrotask(() => setPendingImport(parsed));
      else
        queueMicrotask(() =>
          flash({ kind: 'err', text: 'That share link is invalid or corrupted.' }),
        );
      // Strip the param so a refresh doesn't re-import (and the URL stays clean).
      window.history.replaceState(null, '', window.location.pathname);
    } catch {
      queueMicrotask(() => flash({ kind: 'err', text: 'Could not read that share link.' }));
    }
  }, [flash]);

  useEffect(() => {
    if (loading || !pendingImport) return;
    const duplicate = sets.some(
      (s) => s.name === pendingImport.name && s.words.length === pendingImport.words.length,
    );
    if (duplicate) {
      queueMicrotask(() =>
        flash({ kind: 'ok', text: `"${pendingImport.name}" is already in your library.` }),
      );
    } else {
      void saveSet(pendingImport).then(() =>
        flash({
          kind: 'ok',
          text: `Imported "${pendingImport.name}" (${pendingImport.words.length} words).`,
        }),
      );
    }
    queueMicrotask(() => setPendingImport(null));
  }, [loading, pendingImport, sets, saveSet, flash]);

  const handleShare = async (set: VocabSet) => {
    const url = shareUrlForSet(set);
    try {
      await navigator.clipboard.writeText(url);
      flash({ kind: 'ok', text: 'Share link copied — anyone who opens it imports this set.' });
    } catch {
      // Clipboard API unavailable (e.g. non-secure context) — fall back to a prompt.
      const ok = window.prompt('Copy this share link:', url);
      flash(ok !== null ? { kind: 'ok', text: 'Share link ready to send.' } : { kind: 'err', text: 'Share cancelled.' });
    }
  };

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-5 pb-20 pt-8">
      {/* Sleek floating glass navbar */}
      <header className="animate-fade-up glass mb-10 flex flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl px-4 py-3">
        <Logo />
        <div className="mr-auto">
          <h1 className="text-[15px] font-semibold tracking-tight text-white">AudioRepeat</h1>
          <p className="hidden text-[11px] text-slate-500 sm:block">
            {LANGUAGES.length} languages · hands-free drilling
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <SettingsButton />
          <StreakBadge streak={streak} />
          <InstallAppButton />
          <ProfileDropdown
            onLeaderboard={() => setLeaderboardOpen(true)}
            onSubtitles={() => subtitleInputRef.current?.click()}
            onBrowse={() => setBrowse(true)}
          />
          <NewSetButton
            onNew={() => setEditing('new')}
            onImport={() => fileInputRef.current?.click()}
          />
        </div>
      </header>

      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleImportFile(file);
        }}
      />
      <input
        ref={subtitleInputRef}
        type="file"
        accept=".srt,.vtt,.txt,.ass,.ssa,text/plain,application/x-subrip,application/octet-stream"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleSubtitleFile(file);
        }}
      />

      {week.some((d) => d.words > 0 || d.ms > 0) && (
        <div className="glass animate-fade-up mb-6 rounded-2xl px-5 py-4">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
            <span className="flex items-center gap-2 text-sm font-medium text-slate-300">
              <svg
                viewBox="0 0 24 24"
                className="h-4 w-4 text-neon-cyan"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v5l3 2" />
              </svg>
              Today&apos;s practice
            </span>
            <span className="text-sm text-slate-400">
              {wordsToday} word{wordsToday === 1 ? '' : 's'} listened
            </span>
            <span className="text-sm text-slate-400">· {formatDuration(msToday)} studied</span>
          </div>
          <ActivityHeatmap week={week} />
        </div>
      )}

      {importMsg && (
        <div
          className={`animate-fade-up mb-6 rounded-xl border px-4 py-3 text-sm ${
            importMsg.kind === 'ok'
              ? 'border-neon-green/40 bg-neon-green/10 text-neon-green'
              : 'border-neon-magenta/40 bg-neon-magenta/10 text-neon-magenta'
          }`}
        >
          {importMsg.text}
        </div>
      )}

      {loading ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="glass-card h-44 animate-pulse rounded-2xl" />
          ))}
        </div>
      ) : sets.length === 0 ? (
        <div className="glass-card mx-auto max-w-md rounded-2xl p-10 text-center">
          <p className="text-lg font-semibold text-white">No vocabulary sets yet</p>
          <p className="mt-2 text-sm text-slate-400">
            Create your first set with the + New button, or import a JSON set.
          </p>
        </div>
      ) : (
        <div id="vocab-grid" className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {sets.map((set, i) => (
            <SetCard
              key={set.id}
              set={set}
              index={i}
              onPlay={() => router.push(`/player?id=${set.id}`)}
              onChallenge={() => setChallengeSet(set)}
              onEdit={() => setEditing(set)}
              onExport={() => downloadSet(set)}
              onShare={() => void handleShare(set)}
              onDelete={() => void removeSet(set.id)}
            />
          ))}
        </div>
      )}

      {editing && (
        <SetEditor
          set={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSave={async (set) => {
            const saved = await saveSet(set);
            router.push(`/player?id=${saved.id}`);
          }}
        />
      )}

      {challengeSet && (
        <SpeedChallenge
          set={challengeSet}
          onClose={() => setChallengeSet(null)}
          onRecordWord={(n) => recordWords(n, challengeSet.lang)}
        />
      )}

      {leaderboardOpen && <LeaderboardModal onClose={() => setLeaderboardOpen(false)} />}

      {subtitleImport && (
        <SubtitleImportModal
          fileName={subtitleImport.fileName}
          text={subtitleImport.text}
          defaultLang={defaultSubtitleLang}
          onClose={() => setSubtitleImport(null)}
          onCreate={(set) => {
            // Open the editor to review translations before saving (Save & play).
            setSubtitleImport(null);
            setEditing(set);
          }}
        />
      )}

      {browse && (
        <StarterLibraryModal
          sets={sets}
          onClose={() => setBrowse(false)}
          onImport={async (set) => {
            try {
              await saveSet(set);
              flash({ kind: 'ok', text: `Imported "${set.name}" (${set.words.length} words).` });
            } catch {
              flash({ kind: 'err', text: 'Could not import that starter set.' });
            }
          }}
        />
      )}
    </main>
  );
}
