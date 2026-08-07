'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { useLists } from '@/hooks/useLists';
import { findLanguage } from '@/lib/languages';
import { downloadSet, parseSetJson } from '@/lib/sets/io';
import type { VocabSet } from '@/types/app';
import SetEditor from './SetEditor';

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
  onDelete: () => void;
}

function SetCard({ set, index, isConfirming, onPlay, onEdit, onExport, onDelete }: SetCardProps) {
  return (
    <article
      className="glass animate-fade-up group relative overflow-hidden rounded-2xl p-5 transition-all hover:-translate-y-1 hover:border-neon-cyan/40"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-neon-cyan/10 blur-2xl transition-all duration-500 group-hover:bg-neon-cyan/25" />
      <div className="pointer-events-none absolute -bottom-10 -left-10 h-24 w-24 rounded-full bg-neon-magenta/10 blur-2xl transition-all duration-500 group-hover:bg-neon-magenta/20" />
      <h3 className="text-xl font-semibold text-white">{set.name}</h3>
      <p className="mt-1 text-sm text-slate-400">
        {set.words.length} words · {languageLabel(set.lang)} → {languageLabel(set.nativeLang)}
        {set.settings ? ' · custom settings' : ''}
      </p>
      <div className="mt-5 flex gap-2">
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
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState<VocabSet | 'new' | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [importMsg, setImportMsg] = useState<ImportMsg>(null);

  const flash = (msg: ImportMsg) => {
    setImportMsg(msg);
    if (msg) window.setTimeout(() => setImportMsg((m) => (m === msg ? null : m)), 4000);
  };

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

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-5 pb-20 pt-10">
      <header className="animate-fade-up mb-6 flex flex-wrap items-center gap-4">
        <Logo />
        <div className="mr-auto">
          <h1 className="text-3xl font-bold tracking-tight text-white">AudioRepeat</h1>
          <p className="text-sm text-slate-400">
            Loop. Repeat. Retain. — hands-free vocabulary drilling in 233 languages
          </p>
        </div>
        <div className="flex items-center gap-2">
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
    </main>
  );
}
