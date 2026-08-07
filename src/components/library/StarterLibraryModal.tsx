'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CEFR_META, PACK_LANG, STARTER_LANGS, starterLangLabel } from '@/lib/starterSets';
import {
  getWordBankManifest,
  loadWordBank,
  type WordBankManifest,
  type WordBankWord,
} from '@/lib/vocab/wordBanks';
import { CEFR_LEVELS } from '@/types/app';
import type { CefrLevel, VocabSet } from '@/types/app';
import CefrBadge from './CefrBadge';
import VirtualList from './VirtualList';

interface Props {
  /** The user's existing sets, used to mark levels already imported. */
  sets: VocabSet[];
  onClose: () => void;
  onImport: (set: VocabSet) => void | Promise<void>;
}

const BATCH_SIZES = [20, 50, 200, 500, 1000];
const ROW_HEIGHT = 44;

const selectClass =
  'rounded-xl border border-white/10 bg-night-800/80 px-3 py-2 text-sm text-white outline-none transition focus:border-neon-cyan/60';
const inputClass =
  'w-full rounded-xl border border-white/10 bg-night-800/80 px-3 py-2 text-sm text-white placeholder:text-slate-600 outline-none transition focus:border-neon-cyan/60';

/** Accent-insensitive, case-insensitive match. */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/** Derive "packLang:level" keys already imported from library set ids.
 * Matches both word-pack imports (bank-fr-A1-…, bank-full-fr-A1-…) and the
 * legacy curated starter sets (starter-es-ES-A1). */
function importedLevelKeys(sets: VocabSet[]): Set<string> {
  const keys = new Set<string>();
  for (const set of sets) {
    const bank = /^bank(?:-full)?-([a-z]{2,3})-([A-C][12])-/.exec(set.id);
    if (bank) {
      keys.add(`${bank[1]}:${bank[2]}`);
      continue;
    }
    const starter = /^starter-([a-z]{2,3})-[A-Z]{2}-([A-C][12])$/.exec(set.id);
    if (starter) keys.add(`${starter[1]}:${starter[2]}`);
  }
  return keys;
}

export default function StarterLibraryModal({ sets, onClose, onImport }: Props) {
  const [manifest, setManifest] = useState<WordBankManifest | null>(null);
  const [lang, setLang] = useState<string | null>(null);
  const [level, setLevel] = useState<CefrLevel | null>(null);
  const [bank, setBank] = useState<WordBankWord[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [batchSize, setBatchSize] = useState(200);

  // Escape to close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Load the manifest once; default to the first language that has a pack.
  useEffect(() => {
    let alive = true;
    getWordBankManifest()
      .then((m) => {
        if (!alive) return;
        setManifest(m);
        const first = STARTER_LANGS.map((code) => PACK_LANG[code]).find((code) => m[code]);
        if (first) setLang(first);
      })
      .catch(() => {
        if (alive) setError('The vocabulary library is not available yet — try again online.');
      });
    return () => {
      alive = false;
    };
  }, []);

  // Load the selected level's words
  useEffect(() => {
    let alive = true;
    void (async () => {
      if (!lang || !level) {
        setBank(null);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const b = await loadWordBank(lang, level);
        if (!alive) return;
        setBank(b?.words ?? []);
      } catch {
        if (!alive) return;
        setError('Could not load this level.');
        setBank(null);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [lang, level]);

  const imported = useMemo(() => importedLevelKeys(sets), [sets]);

  const filtered = useMemo(() => {
    if (!bank) return [];
    const q = normalize(query.trim());
    if (!q) return bank;
    return bank.filter(
      ([target, translation]) =>
        normalize(target).includes(q) || normalize(translation).includes(q),
    );
  }, [bank, query]);

  // Totals for the header and per-language progress
  const langTotal = useMemo(
    () =>
      manifest
        ? Object.values(manifest).reduce((sum, levels) => sum + Object.values(levels).reduce((a, n) => a + (n ?? 0), 0), 0)
        : 0,
    [manifest],
  );
  const currentLangLevels = manifest && lang ? manifest[lang] ?? {} : {};
  const currentLangTotal = Object.values(currentLangLevels).reduce((a, n) => a + (n ?? 0), 0);
  const availableLevelCount = CEFR_LEVELS.filter((l) => (currentLangLevels[l] ?? 0) > 0).length;
  const importedLevelCount = lang ? CEFR_LEVELS.filter((l) => imported.has(`${lang}:${l}`)).length : 0;

  const currentLevelCount = lang && level ? (currentLangLevels[level] ?? 0) : 0;

  const practiceBatch = useCallback(
    async (size: number) => {
      if (!lang || !level || filtered.length === 0) return;
      const n = Math.min(size, filtered.length);
      // Random sample without replacement for varied sessions
      const pool = [...filtered];
      const picked: WordBankWord[] = [];
      for (let i = 0; i < n && pool.length > 0; i += 1) {
        const idx = Math.floor(Math.random() * pool.length);
        picked.push(pool.splice(idx, 1)[0]);
      }
      const stamp = Date.now();
      await onImport({
        id: `bank-${lang}-${level}-${stamp}`,
        name: `${starterLangLabel(lang)} ${level} · batch of ${n}`,
        lang,
        nativeLang: 'en-US',
        words: picked.map(([target, translation], i) => ({
          id: `bk-${stamp}-${i}`,
          target,
          translation,
        })),
        cefr: level,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    },
    [lang, level, filtered, onImport],
  );

  const importFull = useCallback(async () => {
    if (!lang || !level || !bank || bank.length === 0) return;
    const stamp = Date.now();
    await onImport({
      id: 'bank-full-' + lang + '-' + level + '-' + stamp,
      name: starterLangLabel(lang) + ' ' + level + ' · full level (' + bank.length.toLocaleString() + ' words)',
      lang,
      nativeLang: 'en-US',
      words: bank.map(([target, translation], i) => ({
        id: 'bkf-' + stamp + '-' + i,
        target,
        translation,
      })),
      cefr: level,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  }, [lang, level, bank, onImport]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Browse library"
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="glass animate-fade-up relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <div>
            <h2 className="text-xl font-bold text-white">Browse library</h2>
            <p className="text-xs text-slate-400">
              {manifest
                ? `Comprehensive CEFR word packs in ${Object.keys(manifest).length} languages — ${langTotal.toLocaleString()} words total. Import a level or practice a batch.`
                : 'Comprehensive CEFR word packs — import a level or practice a batch.'}
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

        {error && !manifest ? (
          <div className="p-10 text-center text-sm text-neon-amber">{error}</div>
        ) : !manifest ? (
          <div className="flex flex-col items-center gap-4 p-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-neon-cyan/30 border-t-neon-cyan" />
            <p className="text-sm text-slate-500">Loading the vocabulary library…</p>
          </div>
        ) : (
          <>
            {/* Language + level */}
            <div className="flex flex-wrap items-center gap-2 border-b border-white/10 px-6 py-3">
              <select
                value={lang ?? ''}
                onChange={(e) => {
                  setLang(e.target.value || null);
                  setLevel(null);
                  setBank(null);
                }}
                className={selectClass}
                aria-label="Language"
              >
                <option value="" disabled>
                  Pick a language
                </option>
                {STARTER_LANGS.map((code) => {
                  const pack = PACK_LANG[code];
                  const count = manifest[pack]
                    ? Object.values(manifest[pack]).reduce((a, n) => a + (n ?? 0), 0)
                    : 0;
                  return (
                    <option key={code} value={pack}>
                      {starterLangLabel(code)} · {count.toLocaleString()} words
                    </option>
                  );
                })}
              </select>

              <div className="flex flex-wrap gap-1.5">
                {CEFR_LEVELS.map((lvl) => {
                  const count = lang ? (manifest[lang][lvl] ?? 0) : 0;
                  const active = level === lvl;
                  const done = lang ? imported.has(`${lang}:${lvl}`) : false;
                  return (
                    <button
                      key={lvl}
                      onClick={() => setLevel(active ? null : lvl)}
                      disabled={!lang || count === 0}
                      title={count > 0 ? `${count} words` : 'Not available yet'}
                      className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                        count === 0
                          ? 'cursor-not-allowed border-white/5 text-slate-600'
                          : active
                            ? CEFR_META[lvl].chip
                            : 'border-white/10 text-slate-400 hover:border-white/25 hover:text-white'
                      }`}
                    >
                      {lvl}
                      {count > 0 && <span className="ml-1 opacity-60">{count.toLocaleString()}</span>}
                      {done && <span className="ml-1 text-neon-green">✓</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Search + batch size */}
            <div className="flex flex-wrap items-center gap-2 border-b border-white/10 px-6 py-3">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Search ${lang ? starterLangLabel(lang) : ''} words…`}
                className={`${inputClass} flex-1`}
              />
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] uppercase tracking-wider text-slate-500">Batch</span>
                {BATCH_SIZES.map((n) => (
                  <button
                    key={n}
                    onClick={() => setBatchSize(n)}
                    className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                      batchSize === n
                        ? 'border-neon-violet/60 bg-neon-violet/15 text-neon-violet'
                        : 'border-white/10 text-slate-400 hover:border-white/25 hover:text-white'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            {!lang || !level ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 p-10 text-center text-sm text-slate-400">
                <p>
                  {!lang
                    ? 'Pick a language to browse its word packs.'
                    : 'Pick a level to see its words.'}
                </p>
                {lang && level === null && (
                  <p className="text-xs text-slate-500">
                    Each level is a full study deck — A1/A2 ≈ 200–300 words, B1/B2 ≈ 500, C1/C2 ≈ 1,000.
                  </p>
                )}
              </div>
            ) : loading ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-4 p-10">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-neon-cyan/30 border-t-neon-cyan" />
                <p className="text-sm text-slate-500">
                  Loading {currentLevelCount.toLocaleString()} words…
                </p>
              </div>
            ) : error ? (
              <div className="p-10 text-center text-sm text-neon-amber">{error}</div>
            ) : (
              <>
                {/* Level info + actions */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-6 py-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <CefrBadge level={level} />
                      <span className="text-xs text-slate-400">{CEFR_META[level].description}</span>
                    </div>
                    <span className="mt-0.5 block text-xs text-slate-500">
                      <span className="font-semibold text-white">{filtered.length.toLocaleString()}</span>{' '}
                      {query ? 'matches' : 'words in this level'}
                      {query && <span> of {bank?.length.toLocaleString() ?? 0}</span>}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        practiceBatch(batchSize).catch((err) =>
                          console.error('[library batch practice]', err),
                        );
                      }}
                      disabled={filtered.length === 0}
                      className="rounded-xl bg-gradient-to-r from-neon-cyan to-neon-violet px-4 py-2 text-sm font-semibold text-night-950 transition hover:brightness-110 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      ▶ Practice batch of {Math.min(batchSize, filtered.length)}
                    </button>
                    <button
                      onClick={() => {
                        importFull().catch((err) =>
                          console.error('[library full import]', err),
                        );
                      }}
                      disabled={!bank || bank.length === 0}
                      title="Import the whole level as one set — play all words"
                      className="rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold text-white transition hover:border-neon-cyan/60 hover:text-neon-cyan active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      ⬇ Play all {bank ? `(${bank.length.toLocaleString()})` : ''}
                    </button>
                  </div>
                </div>

                {/* Virtualized preview */}
                <div className="flex-1 overflow-y-auto px-6 py-4">
                  <div className="mb-2 text-[11px] uppercase tracking-wider text-slate-500">
                    Preview — {filtered.length.toLocaleString()} words (scroll to browse)
                  </div>
                  {filtered.length === 0 ? (
                    <div className="rounded-2xl border border-white/10 p-8 text-center text-sm text-slate-400">
                      No words match “{query}”.
                    </div>
                  ) : (
                    <VirtualList
                      items={filtered}
                      height={Math.min(filtered.length, 9) * ROW_HEIGHT}
                      rowHeight={ROW_HEIGHT}
                      className="rounded-2xl border border-white/10"
                      renderRow={([target, translation]) => (
                        <div className="flex items-center justify-between px-4 text-sm hover:bg-white/5">
                          <span className="font-medium text-white">{target}</span>
                          <span className="truncate pl-4 text-right text-slate-400">{translation}</span>
                        </div>
                      )}
                    />
                  )}
                </div>
              </>
            )}
          </>
        )}

        {/* Footer progress */}
        {manifest && lang && (
          <div className="border-t border-white/10 px-6 py-3">
            <div className="mb-1 flex items-center justify-between text-xs text-slate-400">
              <span>
                {starterLangLabel(lang)}: {importedLevelCount} of {availableLevelCount} levels imported
                {currentLangTotal > 0 && (
                  <span className="text-slate-500"> · {currentLangTotal.toLocaleString()} words</span>
                )}
              </span>
              <span className="font-semibold text-slate-300">
                {Math.round((importedLevelCount / Math.max(availableLevelCount, 1)) * 100)}%
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-neon-cyan to-neon-violet transition-all duration-500"
                style={{
                  width: `${(importedLevelCount / Math.max(availableLevelCount, 1)) * 100}%`,
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
