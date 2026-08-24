'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, RotateCcw, Star, Trash2 } from 'lucide-react';
import { findLanguage, LANGUAGES } from '@/lib/languages';
import LanguageLock from '@/components/library/LanguageLock';
import { CEFR_META } from '@/lib/starterSets';
import { CEFR_LEVELS } from '@/types/app';
import type { CefrLevel, VocabSet, VocabWord } from '@/types/app';
import { cleanEditorWords } from '@/lib/sets/editor';
import {
  applyBulkWordProgress,
  deleteSelectedWords,
  type BulkWordProgress,
} from '@/lib/sets/bulkWordActions';
import { useT, type TKey } from '@/lib/i18n';

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
  const t = useT();
  const [name, setName] = useState(set?.name ?? '');
  const [lang, setLang] = useState(set?.lang ?? defaultLang ?? 'es-ES');
  const [nativeLang, setNativeLang] = useState(set?.nativeLang ?? 'en-US');
  const [words, setWords] = useState<VocabWord[]>(set ? set.words.map((w) => ({ ...w })) : [newWord()]);
  const [cefr, setCefr] = useState<CefrLevel | undefined>(set?.cefr);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [selectedWordIds, setSelectedWordIds] = useState<Set<string>>(() => new Set());
  const [pendingDeleteIds, setPendingDeleteIds] = useState<string[] | null>(null);
  const [bulkStatus, setBulkStatus] = useState('');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (pendingDeleteIds) {
        setPendingDeleteIds(null);
        return;
      }
      onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, pendingDeleteIds]);

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

  const selectedCount = selectedWordIds.size;
  const allSelected = words.length > 0 && selectedCount === words.length;
  const partiallySelected = selectedCount > 0 && !allSelected;

  const toggleWordSelection = (wordId: string) => {
    setPendingDeleteIds(null);
    setSelectedWordIds((previous) => {
      const next = new Set(previous);
      if (next.has(wordId)) next.delete(wordId);
      else next.add(wordId);
      return next;
    });
  };

  const toggleAllWords = () => {
    setPendingDeleteIds(null);
    setSelectedWordIds(allSelected ? new Set() : new Set(words.map((word) => word.id)));
  };

  const applyProgress = (progress: BulkWordProgress, statusKey: TKey) => {
    if (selectedCount === 0) return;
    setWords((previous) => applyBulkWordProgress(previous, selectedWordIds, progress));
    setPendingDeleteIds(null);
    setBulkStatus(t(statusKey, { count: selectedCount }));
  };

  const requestDelete = (ids: Iterable<string>) => {
    const existingIds = new Set(words.map((word) => word.id));
    const requestedIds = Array.from(ids).filter((id) => existingIds.has(id));
    if (requestedIds.length === 0) return;
    setPendingDeleteIds(requestedIds);
    setBulkStatus('');
  };

  const confirmDelete = () => {
    if (!pendingDeleteIds?.length) return;
    const ids = new Set(pendingDeleteIds);
    const count = ids.size;
    setWords((previous) => deleteSelectedWords(previous, ids));
    setSelectedWordIds((previous) => {
      const next = new Set(previous);
      ids.forEach((id) => next.delete(id));
      return next;
    });
    setPendingDeleteIds(null);
    setBulkStatus(t('library.bulk.deletedFromDraft', { count }));
  };

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
      setSaveError(t('library.editor.saveError'));
    } finally {
      setSaving(false);
    }
  }, [valid, saving, locked, name, lang, nativeLang, words, cefr, set, onSave, t]);

  const langHint = findLanguage(lang)?.label;
  const nativeLangHint = findLanguage(nativeLang)?.label;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="set-editor-title"
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="glass animate-fade-up relative max-h-[94dvh] w-full max-w-2xl overflow-x-hidden overflow-y-auto rounded-3xl p-4 sm:max-h-[88vh] sm:p-6">
        <div className="mb-5 flex items-center justify-between">
          <h2 id="set-editor-title" className="text-xl font-bold text-white">
            {set ? t('library.editor.editTitle') : t('library.editor.newTitle')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close')}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-400 transition hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan"
          >
            ✕
          </button>
        </div>

        <label className="block">
          <span className="mb-1 block text-xs font-medium uppercase tracking-wider text-slate-500">
            {t('library.editor.setName')}
          </span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('library.editor.namePlaceholder')}
            className={inputClass}
            autoFocus
          />
        </label>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wider text-slate-500">
              {t('library.editor.targetLanguage')}
            </span>
            <input
              list="lang-presets"
              value={lang}
              onChange={(e) => setLang(e.target.value)}
              placeholder={t('library.editor.targetPlaceholder')}
              className={inputClass}
            />
            <span className="mt-1 block text-[11px] text-slate-500">
              {langHint ? t('library.editor.speakingHint', { lang: langHint }) : t('library.typeToSearch')}
            </span>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wider text-slate-500">
              {t('library.editor.nativeLanguage')}
            </span>
            <input
              list="lang-presets"
              value={nativeLang}
              onChange={(e) => setNativeLang(e.target.value)}
              placeholder={t('library.editor.nativePlaceholder')}
              className={inputClass}
            />
            <span className="mt-1 block text-[11px] text-slate-500">
              {nativeLangHint ? t('library.editor.translationsHint', { lang: nativeLangHint }) : t('library.typeToSearch')}
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
            {t('library.editor.cefrLabel')}
          </span>
          <select
            value={cefr ?? ''}
            onChange={(e) => setCefr((e.target.value || undefined) as CefrLevel | undefined)}
            className={inputClass}
          >
            <option value="">{t('library.editor.noLevel')}</option>
            {CEFR_LEVELS.map((lvl) => (
              <option key={lvl} value={lvl}>
                {lvl} — {CEFR_META[lvl].label}: {CEFR_META[lvl].description}
              </option>
            ))}
          </select>
        </label>

        <div className="mt-5">
          <div className="mb-2 flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
            <label className="inline-flex min-h-11 w-fit cursor-pointer items-center gap-2 rounded-lg pr-2 text-xs font-medium uppercase tracking-wider text-slate-500 focus-within:ring-2 focus-within:ring-neon-cyan">
              <input
                ref={(input) => {
                  if (input) input.indeterminate = partiallySelected;
                }}
                type="checkbox"
                checked={allSelected}
                onChange={toggleAllWords}
                aria-label={allSelected ? t('library.editor.deselectAll') : t('library.editor.selectAll')}
                className="h-4 w-4 cursor-pointer accent-neon-cyan"
              />
              {t('library.editor.wordsCount', { count: words.length })}
            </label>
            <span className="text-[11px] leading-relaxed text-slate-600 sm:text-right">
              {t('library.editor.repeatsHint')}
            </span>
          </div>

          {selectedCount > 0 && (
            <section
              aria-label={t('library.bulk.actionsAria')}
              className="sticky top-0 z-20 mb-3 rounded-2xl border border-neon-cyan/25 bg-night-900 p-3 shadow-xl"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="shrink-0 text-xs font-semibold text-neon-cyan">
                  {t('library.editor.selectedCount', { count: selectedCount })}
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => applyProgress('mastered', 'library.bulk.markedKnown')}
                    className="inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-xl border border-neon-green/25 bg-neon-green/10 px-3 text-xs font-semibold text-neon-green transition hover:bg-neon-green/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan sm:flex-none"
                  >
                    <Check className="h-3.5 w-3.5" aria-hidden /> {t('library.bulk.known')}
                  </button>
                  <button
                    type="button"
                    onClick={() => applyProgress('hard', 'library.bulk.markedReview')}
                    className="inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-xl border border-neon-amber/25 bg-neon-amber/10 px-3 text-xs font-semibold text-neon-amber transition hover:bg-neon-amber/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan sm:flex-none"
                  >
                    <Star className="h-3.5 w-3.5" aria-hidden /> {t('library.bulk.review')}
                  </button>
                  <button
                    type="button"
                    onClick={() => applyProgress('reset', 'library.bulk.markedReset')}
                    className="inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-xs font-semibold text-slate-300 transition hover:border-white/20 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan sm:flex-none"
                  >
                    <RotateCcw className="h-3.5 w-3.5" aria-hidden /> {t('library.bulk.reset')}
                  </button>
                  <button
                    type="button"
                    onClick={() => requestDelete(selectedWordIds)}
                    className="inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-xl border border-neon-magenta/25 bg-neon-magenta/10 px-3 text-xs font-semibold text-neon-magenta transition hover:bg-neon-magenta/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan sm:flex-none"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden /> {t('common.delete')}
                  </button>
                </div>
              </div>
            </section>
          )}

          {pendingDeleteIds && (
            <div
              role="alert"
              className="sticky top-0 z-30 mb-3 rounded-2xl border border-neon-magenta/30 bg-night-900 p-3 shadow-xl"
            >
              <p className="text-sm font-semibold text-white">
                {t('library.bulk.deleteQuestion', { count: pendingDeleteIds.length })}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">
                {t('library.bulk.draftNote')}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={confirmDelete}
                  className="min-h-10 rounded-xl bg-neon-magenta px-4 text-xs font-bold text-white transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan"
                >
                  {t('library.confirmDelete')}
                </button>
                <button
                  type="button"
                  onClick={() => setPendingDeleteIds(null)}
                  className="min-h-10 rounded-xl border border-white/10 px-4 text-xs font-semibold text-slate-300 transition hover:border-white/20 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan"
                >
                  {t('library.keepWords')}
                </button>
              </div>
            </div>
          )}

          <p aria-live="polite" className="sr-only">{bulkStatus}</p>
          <div className="space-y-2">
            {words.map((w, i) => (
              <div key={w.id} className="rounded-xl border border-white/5 bg-night-900/40 p-2">
                <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-1.5 sm:gap-2">
                  <label className="flex h-11 w-9 cursor-pointer items-center justify-center rounded-lg focus-within:ring-2 focus-within:ring-neon-cyan sm:w-11">
                    <input
                      type="checkbox"
                      checked={selectedWordIds.has(w.id)}
                      onChange={() => toggleWordSelection(w.id)}
                      aria-label={t('library.bulk.selectWord', {
                        name: w.target.trim() || t('library.bulk.wordNumber', { n: i + 1 }),
                      })}
                      className="h-4 w-4 cursor-pointer accent-neon-cyan"
                    />
                  </label>
                  <div className="min-w-0">
                    <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2">
                      <input
                        value={w.target}
                        onChange={(e) => updateWord(i, { target: e.target.value })}
                        placeholder={t('library.editor.targetInputPlaceholder')}
                        aria-label={t('library.editor.targetAria', { n: i + 1 })}
                        className="min-w-0 rounded-xl border border-white/10 bg-night-800/80 px-3 py-2 text-sm text-white placeholder:text-slate-600 outline-none transition focus:border-neon-cyan/60"
                      />
                      <input
                        value={w.translation}
                        onChange={(e) => updateWord(i, { translation: e.target.value })}
                        placeholder={t('library.editor.translationInputPlaceholder')}
                        aria-label={t('library.editor.translationAria', { n: i + 1 })}
                        className="min-w-0 rounded-xl border border-white/10 bg-night-800/80 px-3 py-2 text-sm text-white placeholder:text-slate-600 outline-none transition focus:border-neon-cyan/60"
                      />
                    </div>
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-1" aria-label={t('library.bulk.repeatsAria', { n: i + 1 })}>
                        {REPEAT_OPTIONS.map((r) => (
                          <button
                            type="button"
                            key={r}
                            onClick={() => updateWord(i, { repeats: w.repeats === r ? undefined : r })}
                            title={w.repeats === r ? t('library.editor.useDefaultRepeats') : t('library.editor.repeatsN', { count: r })}
                            aria-pressed={w.repeats === r}
                            className={`h-8 w-8 rounded-lg text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan ${
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
                        type="button"
                        onClick={() => requestDelete([w.id])}
                        aria-label={t('library.bulk.deleteWord', {
                          name: w.target.trim() || t('library.bulk.wordNumber', { n: i + 1 }),
                        })}
                        className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-slate-500 transition hover:bg-white/5 hover:text-neon-magenta focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden /> {t('common.delete')}
                      </button>
                    </div>
                  </div>
                </div>
                <input
                  value={w.example ?? ''}
                  onChange={(e) => updateWord(i, { example: e.target.value })}
                  placeholder={t('library.editor.examplePlaceholder', { word: w.target || '¡Gracias!' })}
                  aria-label={t('library.editor.exampleAria', { n: i + 1 })}
                  className="mt-1.5 w-full min-w-0 rounded-xl border border-white/5 bg-night-800/40 px-3 py-2 text-xs text-slate-300 placeholder:text-slate-600 outline-none transition focus:border-neon-cyan/50"
                />
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setWords((prev) => [...prev, newWord()])}
            className="mt-3 min-h-11 rounded-xl border border-dashed border-white/15 px-4 py-2 text-sm text-slate-400 transition hover:border-neon-cyan/50 hover:text-neon-cyan focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan"
          >
            {t('library.editor.addWord')}
          </button>
        </div>

        {saveError && <p role="alert" className="mt-4 text-sm text-neon-magenta">{saveError}</p>}
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 rounded-xl border border-white/10 px-5 py-2.5 text-sm text-slate-300 transition hover:border-white/25 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan"
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={!valid || saving || locked}
            className="min-h-11 rounded-xl bg-gradient-to-r from-neon-cyan to-neon-violet px-5 py-2.5 text-sm font-semibold text-night-950 transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-night-900 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving ? t('common.saving') : set ? t('library.editor.savePlay') : t('library.editor.createPlay')}
          </button>
        </div>
      </div>
    </div>
  );
}
