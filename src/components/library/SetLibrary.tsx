'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useLists } from '@/hooks/useLists';
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

interface SetCardProps {
  set: VocabSet;
  index: number;
  isConfirming: boolean;
  onPlay: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function SetCard({ set, index, isConfirming, onPlay, onEdit, onDelete }: SetCardProps) {
  return (
    <article
      className="glass animate-fade-up group relative overflow-hidden rounded-2xl p-5 transition-all hover:-translate-y-1 hover:border-neon-cyan/40"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-neon-cyan/10 blur-2xl transition-all duration-500 group-hover:bg-neon-cyan/25" />
      <div className="pointer-events-none absolute -bottom-10 -left-10 h-24 w-24 rounded-full bg-neon-magenta/10 blur-2xl transition-all duration-500 group-hover:bg-neon-magenta/20" />
      <h3 className="text-xl font-semibold text-white">{set.name}</h3>
      <p className="mt-1 text-sm text-slate-400">
        {set.words.length} words · {set.lang} → {set.nativeLang}
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
          className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-slate-300 transition hover:border-white/25 hover:text-white active:scale-95"
        >
          Edit
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

export default function SetLibrary() {
  const { sets, loading, saveSet, removeSet } = useLists();
  const router = useRouter();
  const [editing, setEditing] = useState<VocabSet | 'new' | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-5 pb-20 pt-10">
      <header className="animate-fade-up mb-10 flex flex-wrap items-center gap-4">
        <Logo />
        <div className="mr-auto">
          <h1 className="text-3xl font-bold tracking-tight text-white">AudioRepeat</h1>
          <p className="text-sm text-slate-400">
            Loop. Repeat. Retain. — hands-free vocabulary drilling
          </p>
        </div>
        <button
          onClick={() => setEditing('new')}
          className="rounded-xl bg-gradient-to-r from-neon-cyan to-neon-violet px-5 py-2.5 text-sm font-semibold text-night-950 shadow-[0_0_20px_rgba(34,228,255,0.35)] transition hover:brightness-110 active:scale-95"
        >
          + New set
        </button>
      </header>

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
            Create your first set and start drilling hands-free.
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
