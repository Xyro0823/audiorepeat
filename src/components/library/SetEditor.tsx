'use client';

import { useEffect, useState } from 'react';
import type { VocabSet, VocabWord } from '@/types/app';

const REPEAT_OPTIONS = [1, 2, 3, 5];
const LANG_PRESETS = ['es-ES', 'fr-FR', 'de-DE', 'it-IT', 'pt-PT', 'ja-JP', 'ko-KR', 'zh-CN', 'en-US'];

interface Props {
  set: VocabSet | null;
  onClose: () => void;
  onSave: (set: VocabSet) => void | Promise<void>;
}

function newWord(): VocabWord {
  return { id: crypto.randomUUID(), target: '', translation: '' };
}

const inputClass =
  'w-full rounded-xl border border-white/10 bg-night-800/80 px-4 py-2.5 text-white placeholder:text-slate-600 outline-none transition focus:border-neon-cyan/60';

export default function SetEditor({ set, onClose, onSave }: Props) {
  const [name, setName] = useState(set?.name ?? '');
  const [lang, setLang] = useState(set?.lang ?? 'es-ES');
  const [nativeLang, setNativeLang] = useState(set?.nativeLang ?? 'en-US');
  const [words, setWords] = useState<VocabWord[]>(set ? set.words.map((w) => ({ ...w })) : [newWord()]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const valid =
    name.trim().length > 0 && words.some((w) => w.target.trim() && w.translation.trim());

  const updateWord = (i: number, patch: Partial<VocabWord>) =>
    setWords((prev) => prev.map((w, idx) => (idx === i ? { ...w, ...patch } : w)));

  const submit = async () => {
    if (!valid || saving) return;
    setSaving(true);
    const clean = words
      .filter((w) => w.target.trim() && w.translation.trim())
      .map((w) => ({ ...w, target: w.target.trim(), translation: w.translation.trim() }));
    await onSave({
      id: set?.id ?? crypto.randomUUID(),
      name: name.trim(),
      lang,
      nativeLang,
      words: clean,
      createdAt: set?.createdAt ?? Date.now(),
      updatedAt: Date.now(),
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="glass animate-fade-up relative max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-3xl p-6">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">
            {set ? 'Edit set' : 'New vocabulary set'}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg px-2 py-1 text-slate-400 transition hover:bg-white/5 hover:text-white"
          >
            ✕
          </button>
        </div>

        <label className="block">
          <span className="mb-1 block text-xs font-medium uppercase tracking-wider text-slate-500">
            Set name
          </span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. German Basics"
            className={inputClass}
            autoFocus
          />
        </label>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wider text-slate-500">
              Target language
            </span>
            <input
              list="lang-presets"
              value={lang}
              onChange={(e) => setLang(e.target.value)}
              placeholder="es-ES"
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wider text-slate-500">
              Native language
            </span>
            <input
              list="lang-presets"
              value={nativeLang}
              onChange={(e) => setNativeLang(e.target.value)}
              placeholder="en-US"
              className={inputClass}
            />
          </label>
        </div>
        <datalist id="lang-presets">
          {LANG_PRESETS.map((l) => (
            <option key={l} value={l} />
          ))}
        </datalist>

        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-500">
              Words ({words.length})
            </span>
            <span className="text-[11px] text-slate-600">
              repeats: 1×–5× per word, then the translation once
            </span>
          </div>
          <div className="space-y-2">
            {words.map((w, i) => (
              <div key={w.id} className="flex items-center gap-2">
                <input
                  value={w.target}
                  onChange={(e) => updateWord(i, { target: e.target.value })}
                  placeholder="Target (gracias)"
                  className="w-1/3 min-w-0 rounded-xl border border-white/10 bg-night-800/80 px-3 py-2 text-sm text-white placeholder:text-slate-600 outline-none transition focus:border-neon-cyan/60"
                />
                <input
                  value={w.translation}
                  onChange={(e) => updateWord(i, { translation: e.target.value })}
                  placeholder="Translation (thank you)"
                  className="w-1/3 min-w-0 rounded-xl border border-white/10 bg-night-800/80 px-3 py-2 text-sm text-white placeholder:text-slate-600 outline-none transition focus:border-neon-cyan/60"
                />
                <div className="flex items-center gap-1">
                  {REPEAT_OPTIONS.map((r) => (
                    <button
                      key={r}
                      onClick={() => updateWord(i, { repeats: w.repeats === r ? undefined : r })}
                      title={w.repeats === r ? 'Use the global default instead' : `${r} repeats`}
                      className={`h-7 w-7 rounded-lg text-xs font-semibold transition ${
                        w.repeats === r
                          ? 'bg-neon-cyan text-night-950'
                          : 'bg-night-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {r}×
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setWords((prev) => prev.filter((_, idx) => idx !== i))}
                  aria-label="Remove word"
                  className="rounded-lg px-2 py-1.5 text-slate-500 transition hover:bg-white/5 hover:text-neon-magenta"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <button
            onClick={() => setWords((prev) => [...prev, newWord()])}
            className="mt-3 rounded-xl border border-dashed border-white/15 px-4 py-2 text-sm text-slate-400 transition hover:border-neon-cyan/50 hover:text-neon-cyan"
          >
            + Add word
          </button>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-xl border border-white/10 px-5 py-2.5 text-sm text-slate-300 transition hover:border-white/25 hover:text-white"
          >
            Cancel
          </button>
          <button
            onClick={() => void submit()}
            disabled={!valid || saving}
            className="rounded-xl bg-gradient-to-r from-neon-cyan to-neon-violet px-5 py-2.5 text-sm font-semibold text-night-950 transition hover:brightness-110 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving ? 'Saving…' : set ? 'Save & play' : 'Create & play'}
          </button>
        </div>
      </div>
    </div>
  );
}
