'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { LANGUAGES } from '@/lib/languages';
import {
  CEFR_META,
  STARTER_LANGS,
  STARTER_SETS,
  starterLangLabel,
  starterTitle,
  type StarterSet,
} from '@/lib/starterSets';
import { CEFR_LEVELS } from '@/types/app';
import type { CefrLevel, VocabSet } from '@/types/app';
import CefrBadge from './CefrBadge';
import WordBankTab from './WordBankTab';

interface Props {
  sets: VocabSet[];
  onClose: () => void;
  onImport: (set: VocabSet) => void | Promise<void>;
}

const selectClass =
  'rounded-xl border border-white/10 bg-night-800/80 px-3 py-2 text-sm text-white outline-none transition focus:border-neon-cyan/60';

type Tab = 'starter' | 'banks';

export default function StarterLibraryModal({ sets, onClose, onImport }: Props) {
  const [tab, setTab] = useState<Tab>('starter');
  const [lang, setLang] = useState<string>('all');
  const [level, setLevel] = useState<CefrLevel | 'all'>('all');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const importedIds = useMemo(() => new Set(sets.map((s) => s.id)), [sets]);

  const filtered = useMemo(
    () =>
      STARTER_SETS.filter(
        (s) => (lang === 'all' || s.lang === lang) && (level === 'all' || s.level === level),
      ),
    [lang, level],
  );

  // Progress scope: the selected language, or the whole library when "All".
  const scope = useMemo(
    () => (lang === 'all' ? STARTER_SETS : STARTER_SETS.filter((s) => s.lang === lang)),
    [lang],
  );
  const importedCount = scope.filter((s) => importedIds.has(s.id)).length;

  const handleImport = useCallback(
    async (starter: StarterSet) => {
      if (importedIds.has(starter.id)) return;
      await onImport({
        id: starter.id,
        name: starterTitle(starter),
        lang: starter.lang,
        nativeLang: 'en-US',
        words: starter.words.map((w, i) => ({
          id: `sw-${starter.id}-${i}`,
          target: w.target,
          translation: w.translation,
        })),
        cefr: starter.level,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    },
    [importedIds, onImport],
  );

  const tabBtn = (key: Tab, label: string, hint: string) => (
    <button
      onClick={() => setTab(key)}
      className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${
        tab === key
          ? 'bg-gradient-to-r from-neon-cyan/25 to-neon-violet/25 text-white ring-1 ring-neon-cyan/40'
          : 'text-slate-400 hover:text-white'
      }`}
    >
      {label}
      <span className="ml-1.5 hidden text-slate-500 sm:inline">{hint}</span>
    </button>
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Browse library"
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="glass animate-fade-up relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl">
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <div>
            <h2 className="text-xl font-bold text-white">Browse library</h2>
            <p className="text-xs text-slate-400">
              CEFR starter sets &amp; large word banks — import or practice in batches
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg px-2 py-1 text-slate-400 transition hover:bg-white/5 hover:text-white"
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 border-b border-white/10 px-6 py-2.5">
          {tabBtn('starter', 'Starter sets', '· 60 words')}
          {tabBtn('banks', 'Word banks', '· 1,000+ words')}
        </div>

        {tab === 'banks' ? (
          <WordBankTab onImport={onImport} />
        ) : (
          <>
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2 border-b border-white/10 px-6 py-3">
              <select value={lang} onChange={(e) => setLang(e.target.value)} className={selectClass}>
                <option value="all">All languages</option>
                {LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.label}
                  </option>
                ))}
              </select>
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => setLevel('all')}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                    level === 'all'
                      ? 'border-neon-cyan/60 bg-neon-cyan/15 text-neon-cyan'
                      : 'border-white/10 text-slate-400 hover:border-white/25 hover:text-white'
                  }`}
                >
                  All
                </button>
                {CEFR_LEVELS.map((lvl) => (
                  <button
                    key={lvl}
                    onClick={() => setLevel((cur) => (cur === lvl ? 'all' : lvl))}
                    className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                      level === lvl
                        ? CEFR_META[lvl].chip
                        : 'border-white/10 text-slate-400 hover:border-white/25 hover:text-white'
                    }`}
                  >
                    {lvl}
                  </button>
                ))}
              </div>
            </div>

            {/* Progress for current scope */}
            <div className="border-b border-white/10 px-6 py-3">
              <div className="mb-1 flex items-center justify-between text-xs text-slate-400">
                <span>
                  {lang === 'all'
                    ? `Library progress: ${importedCount} of ${scope.length} sets imported`
                    : `${starterLangLabel(lang)}: ${importedCount} of ${scope.length} levels imported`}
                </span>
                <span className="font-semibold text-slate-300">
                  {Math.round((importedCount / Math.max(scope.length, 1)) * 100)}%
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-neon-cyan to-neon-violet transition-all duration-500"
                  style={{ width: `${(importedCount / Math.max(scope.length, 1)) * 100}%` }}
                />
              </div>
            </div>

            {/* Language quick chips */}
            <div className="flex flex-wrap gap-1.5 px-6 pt-3">
              {STARTER_LANGS.map((code) => (
                <button
                  key={code}
                  onClick={() => setLang((cur) => (cur === code ? 'all' : code))}
                  className={`rounded-full border px-2.5 py-0.5 text-[11px] transition ${
                    lang === code
                      ? 'border-neon-magenta/60 bg-neon-magenta/15 text-neon-magenta'
                      : 'border-white/10 text-slate-400 hover:border-white/25 hover:text-white'
                  }`}
                >
                  {starterLangLabel(code)}
                </button>
              ))}
            </div>

            {/* Starter set grid */}
            <div className="grid flex-1 gap-3 overflow-y-auto p-6 pt-4 sm:grid-cols-2">
              {filtered.length === 0 ? (
                <div className="col-span-full rounded-2xl border border-white/10 p-8 text-center text-sm text-slate-400">
                  No starter sets match{lang !== 'all' ? ` for ${starterLangLabel(lang)}` : ''} —
                  try another language or level.
                </div>
              ) : (
                filtered.map((starter) => {
                  const imported = importedIds.has(starter.id);
                  return (
                    <div
                      key={starter.id}
                      className="group rounded-2xl border border-white/10 bg-night-800/60 p-4 transition hover:border-neon-cyan/30"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="font-semibold text-white">{starterTitle(starter)}</h3>
                        <CefrBadge level={starter.level} />
                      </div>
                      <p className="mt-1 text-xs text-slate-400">
                        {CEFR_META[starter.level].description}
                      </p>
                      <div className="mt-3 flex items-center justify-between gap-2">
                        <span className="text-xs text-slate-500">
                          {starter.words.length} words · {starterLangLabel(starter.lang)}
                        </span>
                        <button
                          onClick={() => {
                            handleImport(starter).catch((err) =>
                              console.error('[starter import]', err),
                            );
                          }}
                          disabled={imported}
                          className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition active:scale-95 ${
                            imported
                              ? 'cursor-default border border-neon-green/40 bg-neon-green/10 text-neon-green'
                              : 'bg-gradient-to-r from-neon-cyan to-neon-violet text-night-950 hover:brightness-110'
                          }`}
                        >
                          {imported ? '✓ Imported' : '+ Import set'}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
