'use client';

import { useCallback, useEffect, useState } from 'react';
import { findLanguage, LANGUAGES } from '@/lib/languages';
import LanguageLock from '@/components/library/LanguageLock';
import { CEFR_META } from '@/lib/starterSets';
import { CEFR_LEVELS } from '@/types/app';
import type { CefrLevel, VocabSet, VocabWord } from '@/types/app';
import { cleanEditorWords } from '@/lib/sets/editor';

const REPEAT_OPTIONS = [1, 2, 3, 5];

interface Props {
  set: VocabSet | null;
  /** Free-plan language gate (lib/planGate). Pro/Lifetime → all languages;
   *  Free → only the single active language. Re-checked at save time. */
  canUseLang: (code: string) => boolean;
  /** Default target language for a NEW set (e.g. the Free plan's chosen
   *  language) — avoids opening the editor on a language the user can't use. */
  defaultLang?: string;
  onClose: () => void;
  onSave: (set: VocabSet) => void | Promise<void>;
}

function newWord(): VocabWord {
  return { id: crypto.randomUUID(), target: '', translation: '' };
}

const inputClass =
  'w-full rounded-xl border border-white/10 bg-night-800/80 px-4 py-2.5 text-white placeholder:text-slate-600 outline-none transition focus:border-neon-cyan/60';

export default function SetEditor({ set, canUseLang, defaultLang, onClose, onSave }: Props) {
  const [name, setName] = useState(set?.name ?? '');
  const [lang, setLang] = useState(set?.lang ?? defaultLang ?? 'es-ES');
  const [nativeLang, setNativeLang] = useState(set?.nativeLang ?? 'en-US');
  const [words, setWords] = useState<VocabWord[]>(set ? set.words.map((w) => ({ ...w })) : [newWord()]);
  const [cefr, setCefr] = useState<CefrLevel | undefined>(set?.cefr);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const valid = name.trim().length > 0 && cleanEditorWords(words).length > 0;

  // Free-plan language gate: a Free user may only create/edit sets in their
  // single active language (the languages they have visible sets in). This
  // drives the inline lock message + disabled save AND is re-checked inside
  // submit() so a stale UI state or direct call can never create a set in a
  // locked language. Editing an EXISTING accessible set is always fine — its
  // language is necessarily owned (it's visible).
  const locked = !canUseLang(lang);

  const updateWord = (i: number, patch: Partial<VocabWord>) =>
    setWords((prev) => prev.map((w, idx) => (idx === i ? { ...w, ...patch } : w)));

  const submit = useCallback(async () => {
    if (!valid || saving) return;
    if (locked) return; // save-time gate — never create in a locked language
    setSaveError(null);
    setSaving(true);
    try {
      const clean = cleanEditorWords(words);
      // Never save a set with zero valid words after cleaning.
      if (clean.length === 0) return;
      await onSave({
        id: set?.id ?? crypto.randomUUID(),
        name: name.trim(),
        lang,
        nativeLang,
        words: clean,
        cefr,
        createdAt: set?.createdAt ?? Date.now(),
        updatedAt: Date.now(),
      });
    } catch {
      // Save failed — keep the editor open so the user can retry.
      setSaveError('Could not save this set. Your changes are still here — please try again.');
    } finally {
      setSaving(false);
    }
  }, [valid, saving, locked, name, lang, nativeLang, words, cefr, set, onSave]);

  const langHint = findLanguage(lang)?.label;
  const nativeLangHint = findLanguage(nativeLang)?.label;

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

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wider text-slate-500">
              Target language
            </span>
            <input
              list="lang-presets"
              value={lang}
              onChange={(e) => setLang(e.target.value)}
              placeholder="e.g. es-ES or German (Germany)"
              className={inputClass}
            />
            <span className="mt-1 block text-[11px] text-slate-500">
              {langHint ? `Speaking: ${langHint}` : 'Start typing to search languages'}
            </span>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wider text-slate-500">
              Native language
            </span>
            <input
              list="lang-presets"
              value={nativeLang}
              onChange={(e) => setNativeLang(e.target.value)}
              placeholder="e.g. en-US"
              className={inputClass}
            />
            <span className="mt-1 block text-[11px] text-slate-500">
              {nativeLangHint ? `Translations in: ${nativeLangHint}` : 'Start typing to search languages'}
            </span>
          </label>
        </div>
        <datalist id="lang-presets">
          {LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>
              {canUseLang(l.code) ? l.label : `🔒 ${l.label}`}
            </option>
          ))}
        </datalist>

        {locked && <LanguageLock className="mt-4" />}

        <label className="mt-4 block">
          <span className="mb-1 block text-xs font-medium uppercase tracking-wider text-slate-500">
            CEFR level (optional)
          </span>
          <select
            value={cefr ?? ''}
            onChange={(e) => setCefr((e.target.value || undefined) as CefrLevel | undefined)}
            className={inputClass}
          >
            <option value="">No level</option>
            {CEFR_LEVELS.map((lvl) => (
              <option key={lvl} value={lvl}>
                {lvl} — {CEFR_META[lvl].label}: {CEFR_META[lvl].description}
              </option>
            ))}
          </select>
        </label>

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
              <div key={w.id} className="rounded-xl border border-white/5 bg-night-900/40 p-2">
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    value={w.target}
                    onChange={(e) => updateWord(i, { target: e.target.value })}
                    placeholder="Target (gracias)"
                    className="min-w-0 flex-1 basis-[120px] rounded-xl border border-white/10 bg-night-800/80 px-3 py-2 text-sm text-white placeholder:text-slate-600 outline-none transition focus:border-neon-cyan/60"
                  />
                  <input
                    value={w.translation}
                    onChange={(e) => updateWord(i, { translation: e.target.value })}
                    placeholder="Translation (thank you)"
                    className="min-w-0 flex-1 basis-[120px] rounded-xl border border-white/10 bg-night-800/80 px-3 py-2 text-sm text-white placeholder:text-slate-600 outline-none transition focus:border-neon-cyan/60"
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
                <input
                  value={w.example ?? ''}
                  onChange={(e) => updateWord(i, { example: e.target.value })}
                  placeholder={`Example sentence (optional) — e.g. "${w.target || '¡Gracias!'}" in context`}
                  className="mt-1.5 w-full rounded-xl border border-white/5 bg-night-800/40 px-3 py-1.5 text-xs text-slate-300 placeholder:text-slate-600 outline-none transition focus:border-neon-cyan/50"
                />
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

        {saveError && <p role="alert" className="mt-4 text-sm text-neon-magenta">{saveError}</p>}
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-xl border border-white/10 px-5 py-2.5 text-sm text-slate-300 transition hover:border-white/25 hover:text-white"
          >
            Cancel
          </button>
          <button
            onClick={() => void submit()}
            disabled={!valid || saving || locked}
            className="rounded-xl bg-gradient-to-r from-neon-cyan to-neon-violet px-5 py-2.5 text-sm font-semibold text-night-950 transition hover:brightness-110 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving ? 'Saving…' : set ? 'Save & play' : 'Create & play'}
          </button>
        </div>
      </div>
    </div>
  );
}
