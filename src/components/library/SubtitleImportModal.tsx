'use client';

import { useMemo, useState } from 'react';
import LanguageLock from '@/components/library/LanguageLock';
import { findLanguage, LANGUAGES } from '@/lib/languages';
import { PACK_LANG } from '@/lib/starterSets';
import { parseSubtitleText } from '@/lib/subtitles/parser';
import { translateKeywords } from '@/lib/subtitles/matcher';
import { useT } from '@/lib/i18n';
import useDialogA11y from '@/hooks/useDialogA11y';
import type { VocabSet } from '@/types/app';

const PLACEHOLDER = '—'; // fill me in

function baseName(fileName: string): string {
  const base = fileName.replace(/\.[^.]+$/, '').trim();
  return base || 'subtitle';
}

interface Props {
  fileName: string;
  text: string;
  /** Preferred target language (BCP-47); the user can change it. */
  defaultLang: string;
  /** Free-plan language gate (lib/planGate) — Pro allows all, Free allows
   *  only the single active language. Early UX layer; SetEditor re-checks
   *  at save time. */
  canUseLang: (code: string) => boolean;
  onClose: () => void;
  /** Called with the parsed set (not yet saved) once translations are matched. */
  onCreate: (set: VocabSet) => void;
}

export default function SubtitleImportModal({ fileName, text, defaultLang, canUseLang, onClose, onCreate }: Props) {
  const t = useT();
  const [lang, setLang] = useState(defaultLang);
  const [busy, setBusy] = useState(false);
  const [previewCount, setPreviewCount] = useState(12);

  const parsed = useMemo(() => parseSubtitleText(text), [text]);

  const dialogRef = useDialogA11y<HTMLDivElement>(true, onClose);

  const langHint = findLanguage(lang)?.label;
  const hasPack = !!PACK_LANG[lang];

  // Early Free-plan gate: an empty/unknown language is NOT blocked (existing
  // behavior preserved — the editor's save-time validation remains the final
  // authority); any explicitly chosen language is gated via the shared
  // planGate logic so a hidden (downgraded) language can never be used here.
  const locked = lang.trim().length > 0 && !canUseLang(lang);

  const create = async () => {
    if (parsed.words.length === 0 || busy) return;
    if (locked) return; // early layer — never write a set in a locked language
    setBusy(true);
    try {
      const translations = await translateKeywords(
        lang,
        parsed.words.map((w) => w.target),
      );
      const words = parsed.words.map((w) => ({
        id: crypto.randomUUID(),
        target: w.target,
        translation: translations.get(w.target) ?? PLACEHOLDER,
      }));
      onCreate({
        id: crypto.randomUUID(),
        name: t('library.subtitles.setName', { name: baseName(fileName) }),
        lang,
        nativeLang: 'en-US',
        words,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={t('library.subtitles.title')}
      className="fixed inset-0 z-50 flex items-center justify-center bg-night-950/80 p-4 backdrop-blur-sm"
    >
      <div className="glass animate-fade-up max-h-[88vh] w-full max-w-md overflow-y-auto rounded-3xl p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">{t('library.subtitles.title')}</h2>
          <button
            onClick={onClose}
            aria-label={t('common.close')}
            className="rounded-lg px-2 py-1 text-slate-400 transition hover:bg-white/5 hover:text-white"
          >
            ✕
          </button>
        </div>

        <p className="mt-1 truncate text-sm text-slate-400">{fileName}</p>

        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-night-800/60 px-2 py-2">
            <p className="text-lg font-bold tabular-nums text-neon-cyan">{parsed.words.length}</p>
            <p className="text-[10px] uppercase tracking-normal text-slate-500 sm:tracking-wider">{t('library.subtitles.keywords')}</p>
          </div>
          <div className="rounded-xl bg-night-800/60 px-2 py-2">
            <p className="text-lg font-bold tabular-nums text-neon-violet">{parsed.totalTokens}</p>
            <p className="text-[10px] uppercase tracking-normal text-slate-500 sm:tracking-wider">{t('library.subtitles.tokens')}</p>
          </div>
          <div className="rounded-xl bg-night-800/60 px-2 py-2">
            <p className="text-lg font-bold tabular-nums text-neon-amber">{parsed.dialogLines}</p>
            <p className="text-[10px] uppercase tracking-normal text-slate-500 sm:tracking-wider">{t('library.subtitles.dialogLines')}</p>
          </div>
        </div>

        <label className="mt-4 block">
          <span className="mb-1 block text-xs font-medium uppercase tracking-wider text-slate-500">
            {t('library.subtitles.languageLabel')}
          </span>
          <input
            list="sub-lang-presets"
            value={lang}
            onChange={(e) => setLang(e.target.value)}
            placeholder={t('library.subtitles.langPlaceholder')}
            className="w-full rounded-xl border border-white/10 bg-night-800/80 px-4 py-2.5 text-white outline-none transition placeholder:text-slate-600 focus:border-neon-amber/60"
          />
          <span className="mt-1 block text-[11px] text-slate-500">
            {langHint
              ? hasPack
                ? t('library.subtitles.hintPack', { lang: langHint })
                : t('library.subtitles.hintNoPack', { lang: langHint })
              : t('library.typeToSearch')}
          </span>
        </label>
        <datalist id="sub-lang-presets">
          {LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>
              {canUseLang(l.code) ? l.label : `🔒 ${l.label}`}
            </option>
          ))}
        </datalist>

        {locked && <LanguageLock className="mt-4" />}

        <div className="mt-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-500">
              {t('library.subtitles.mostFrequent')}
            </span>
            {previewCount < parsed.words.length && (
              <button
                onClick={() => setPreviewCount((c) => c + 12)}
                className="text-[11px] text-slate-500 transition hover:text-neon-amber"
              >
                {t('library.subtitles.showMore')}
              </button>
            )}
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {parsed.words.slice(0, previewCount).map((w) => (
              <span
                key={w.target}
                className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-slate-300"
              >
                {w.target}
                <span className="ml-1 text-[10px] text-slate-500">×{w.count}</span>
              </span>
            ))}
            {parsed.words.length === 0 && (
              <p className="text-xs text-slate-500">
                {t('library.subtitles.noKeywords')}
              </p>
            )}
          </div>
        </div>

        <div className="mt-6 flex gap-2">
          <button
            onClick={() => void create()}
            disabled={parsed.words.length === 0 || busy || locked}
            className="flex-1 rounded-xl bg-gradient-to-r from-neon-amber to-neon-magenta px-5 py-3 text-sm font-bold text-night-950 transition hover:brightness-110 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? t('library.subtitles.matching') : t('library.subtitles.createSet', { count: parsed.words.length })}
          </button>
          <button
            onClick={onClose}
            className="rounded-xl border border-white/10 px-5 py-3 text-sm font-medium text-slate-300 transition hover:border-white/25 hover:text-white"
          >
            {t('common.cancel')}
          </button>
        </div>

        <p className="mt-3 text-[11px] leading-relaxed text-slate-600">
          {t('library.subtitles.footnote')}
        </p>
      </div>
    </div>
  );
}
