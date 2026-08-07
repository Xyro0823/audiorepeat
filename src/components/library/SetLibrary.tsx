'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
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
import SetEditor from './SetEditor';
import StarterLibraryModal from './StarterLibraryModal';

function Logo() {
  return (
    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#141433] to-night-950 shadow-[0_0_30px_rgba(34,228,255,0.25)]">
      <svg
        viewBox="0 0 24 24"
        className="h-7 w-7 text-neon-cyan drop-shadow-[0_0_6px_rgba(34,228,255,0.9)]"
        fill="currentColor"
      >
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
  isConfirming: boolean;
  onPlay: () => void;
  onEdit: () => void;
  onExport: () => void;
  onShare: () => void;
  onDelete: () => void;
}

function SetCard({ set, index, isConfirming, onPlay, onEdit, onExport, onShare, onDelete }: SetCardProps) {
  const total = set.words.length;
  const mastered = set.words.filter((w) => w.mastery === 'mastered').length;
  const hard = set.words.filter((w) => w.mastery === 'hard').length;
  const pct = total > 0 ? Math.round((mastered / total) * 100) : 0;

  return (
    <article
      className="glass animate-fade-up group relative overflow-hidden rounded-2xl p-5 transition-all hover:-translate-y-1 hover:border-neon-cyan/40"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-neon-cyan/10 blur-2xl transition-all duration-500 group-hover:bg-neon-cyan/25" />
      <div className="pointer-events-none absolute -bottom-10 -left-10 h-24 w-24 rounded-full bg-neon-magenta/10 blur-2xl transition-all duration-500 group-hover:bg-neon-magenta/20" />
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-xl font-semibold text-white">{set.name}</h3>
        {set.cefr && <CefrBadge level={set.cefr} />}
      </div>
      <p className="mt-1 text-sm text-slate-400">
        {set.words.length} words · {languageLabel(set.lang)} → {languageLabel(set.nativeLang)}
        {set.settings ? ' · custom settings' : ''}
      </p>
      <div className="mt-4">
        <div className="flex items-center justify-between text-[11px]">
          <span className="font-medium text-slate-400">{pct}% mastered</span>
          {hard > 0 && (
            <span className="text-neon-amber">
              {hard} to review
            </span>
          )}
        </div>
        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-night-800">
          <div
            className="h-full rounded-full bg-gradient-to-r from-neon-green to-neon-cyan transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <button
          onClick={onPlay}
          className="flex-1 rounded-xl bg-gradient-to-r from-neon-cyan to-neon-violet py-2.5 text-sm font-semibold text-night-950 transition hover:brightness-110 active:scale-95"
        >
          ▶ Play
        </button>
        <button
          onClick={onEdit}
          className="rounded-xl border border-white/10 px-3 py-2.5 text-sm text-slate-300 transition hover:border-white/25 hover:text-white active:scale-95"
        >
          Edit
        </button>
        <button
          onClick={onExport}
          aria-label="Export set as JSON"
          title="Export as JSON"
          className="rounded-xl border border-white/10 px-3 py-2.5 text-sm text-slate-400 transition hover:border-neon-cyan/40 hover:text-neon-cyan active:scale-95"
        >
          ⬇
        </button>
        {!set.id.startsWith('seed-') && (
          <button
            onClick={onShare}
            aria-label="Copy share link"
            title="Copy a share link — anyone who opens it gets this set"
            className="rounded-xl border border-white/10 px-3 py-2.5 text-sm text-slate-400 transition hover:border-neon-violet/40 hover:text-neon-violet active:scale-95"
          >
            🔗
          </button>
        )}
        <button
          onClick={onDelete}
          aria-label="Delete set"
          className={`rounded-xl border px-3 py-2.5 text-sm transition active:scale-95 ${
            isConfirming
              ? 'border-neon-magenta bg-neon-magenta/15 text-neon-magenta'
              : 'border-white/10 text-slate-400 hover:border-neon-magenta/40 hover:text-neon-magenta'
          }`}
        >
          {isConfirming ? 'Sure?' : '✕'}
        </button>
      </div>
    </article>
  );
}

type ImportMsg = { kind: 'ok' | 'err'; text: string } | null;

export default function SetLibrary() {
  const { sets, loading, saveSet, removeSet } = useLists();
  const { wordsToday, msToday, streak, week } = usePracticeStats();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState<VocabSet | 'new' | null>(null);
  const [browse, setBrowse] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
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
    <main className="mx-auto w-full max-w-5xl flex-1 px-5 pb-20 pt-10">
      <header className="animate-fade-up mb-6 flex flex-wrap items-center gap-4">
        <Logo />
        <div className="mr-auto">
          <h1 className="text-3xl font-bold tracking-tight text-white">AudioRepeat</h1>
          <p className="text-sm text-slate-400">
            Loop. Repeat. Retain. — hands-free vocabulary drilling in {LANGUAGES.length} languages
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StreakBadge streak={streak} />
          <Link
            href="/stats"
            className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-medium text-slate-300 transition hover:border-neon-cyan/40 hover:text-white active:scale-95"
          >
            📊 Stats
          </Link>
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
          <button
            onClick={() => setBrowse(true)}
            className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-medium text-slate-300 transition hover:border-neon-cyan/40 hover:text-white active:scale-95"
          >
            📚 Browse library
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-medium text-slate-300 transition hover:border-neon-cyan/40 hover:text-white active:scale-95"
          >
            ⬆ Import
          </button>
          <button
            onClick={() => setEditing('new')}
            className="rounded-xl bg-gradient-to-r from-neon-cyan to-neon-violet px-5 py-2.5 text-sm font-semibold text-night-950 shadow-[0_0_20px_rgba(34,228,255,0.35)] transition hover:brightness-110 active:scale-95"
          >
            + New set
          </button>
        </div>
      </header>

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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="glass h-44 animate-pulse rounded-2xl" />
          ))}
        </div>
      ) : sets.length === 0 ? (
        <div className="glass mx-auto max-w-md rounded-2xl p-10 text-center">
          <p className="text-lg font-semibold text-white">No vocabulary sets yet</p>
          <p className="mt-2 text-sm text-slate-400">
            Create your first set, or import one with the ⬆ button.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sets.map((set, i) => (
            <SetCard
              key={set.id}
              set={set}
              index={i}
              isConfirming={confirmId === set.id}
              onPlay={() => router.push(`/player?id=${set.id}`)}
              onEdit={() => setEditing(set)}
              onExport={() => downloadSet(set)}
              onShare={() => void handleShare(set)}
              onDelete={() => {
                if (confirmId === set.id) {
                  void removeSet(set.id);
                  setConfirmId(null);
                } else {
                  setConfirmId(set.id);
                  window.setTimeout(() =>
                    setConfirmId((c) => (c === set.id ? null : c)),
                    2500,
                  );
                }
              }}
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
