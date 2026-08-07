'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { findLanguage } from '@/lib/languages';
import {
  getWordBankManifest,
  loadWordBank,
  type WordBankManifest,
  type WordBankWord,
} from '@/lib/vocab/wordBanks';
import { CEFR_LEVELS } from '@/types/app';
import type { CefrLevel, VocabSet } from '@/types/app';
import VirtualList from './VirtualList';

interface Props {
  onImport: (set: VocabSet) => void | Promise<void>;
}

const BATCH_SIZES = [10, 20, 50, 200, 500, 1000];
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

export default function WordBankTab({ onImport }: Props) {
  const [manifest, setManifest] = useState<WordBankManifest | null>(null);
  const [lang, setLang] = useState<string>('');
  const [level, setLevel] = useState<CefrLevel | null>(null);
  const [bank, setBank] = useState<WordBankWord[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [batchSize, setBatchSize] = useState(20);

  useEffect(() => {
    let alive = true;
    getWordBankManifest()
      .then((m) => {
        if (!alive) return;
        setManifest(m);
        const langs = Object.keys(m);
        if (langs.length > 0) setLang(langs[0]);
      })
      .catch(() => {
        if (alive) setError('Word banks are not available offline yet — try again online.');
      });
    return () => {
      alive = false;
    };
  }, []);

  // Load the selected level for the selected language
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
        setError('Could not load this word bank.');
        setBank(null);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [lang, level]);

  const langLabel = (code: string) => findLanguage(code)?.label ?? code;

  const filtered = useMemo(() => {
    if (!bank) return [];
    const q = normalize(query.trim());
    if (!q) return bank;
    return bank.filter(
      ([target, translation]) =>
        normalize(target).includes(q) || normalize(translation).includes(q),
    );
  }, [bank, query]);

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
        name: `${langLabel(lang)} ${level} · batch of ${n}`,
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
      name: langLabel(lang) + ' ' + level + ' · full level (' + bank.length + ' words)',
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

  const availableLevels = manifest?.[lang];
  const wordCount =
    manifest && lang && level ? (manifest[lang][level] ?? 0) : 0;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {error && !manifest && (
        <div className="p-6 text-center text-sm text-neon-amber">{error}</div>
      )}

      {manifest && (
        <>
          {/* Language + level */}
          <div className="flex flex-wrap items-center gap-2 border-b border-white/10 px-6 py-3">
            <select
              value={lang}
              onChange={(e) => {
                setLang(e.target.value);
                setLevel(null);
                setBank(null);
              }}
              className={selectClass}
            >
              {Object.keys(manifest).map((code) => (
                <option key={code} value={code}>
                  {langLabel(code)}
                </option>
              ))}
            </select>
            <div className="flex flex-wrap gap-1.5">
              {CEFR_LEVELS.map((lvl) => {
                const count = availableLevels?.[lvl] ?? 0;
                const active = level === lvl;
                return (
                  <button
                    key={lvl}
                    onClick={() => setLevel(active ? null : lvl)}
                    disabled={count === 0}
                    title={count > 0 ? `${count} words` : 'Not available yet'}
                    className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                      count === 0
                        ? 'cursor-not-allowed border-white/5 text-slate-600'
                        : active
                          ? 'border-neon-cyan/60 bg-neon-cyan/15 text-neon-cyan'
                          : 'border-white/10 text-slate-400 hover:border-white/25 hover:text-white'
                    }`}
                  >
                    {lvl}
                    {count > 0 && <span className="ml-1 opacity-60">{count}</span>}
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
              placeholder={`Search ${lang ? langLabel(lang) : ''} words…`}
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

          {!level ? (
            <div className="p-10 text-center text-sm text-slate-400">
              Pick a level to browse the word bank.
            </div>
          ) : loading ? (
            <div className="p-10 text-center text-sm text-slate-400">Loading {wordCount} words…</div>
          ) : error ? (
            <div className="p-10 text-center text-sm text-neon-amber">{error}</div>
          ) : (
            <>
              {/* Counts + practice */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-6 py-3">
                <span className="text-xs text-slate-400">
                  <span className="font-semibold text-white">{filtered.length.toLocaleString()}</span>{' '}
                  {query ? 'matches' : `words in ${level}`}
                  {query && (
                    <span className="text-slate-500">
                      {' '}
                      of {bank?.length.toLocaleString() ?? 0}
                    </span>
                  )}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      practiceBatch(batchSize).catch((err) =>
                        console.error('[word bank practice]', err),
                      );
                    }}
                    disabled={filtered.length === 0}
                    className="rounded-xl bg-gradient-to-r from-neon-cyan to-neon-violet px-4 py-2 text-sm font-semibold text-night-950 transition hover:brightness-110 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    ▶ Practice batch of {Math.min(batchSize, filtered.length || batchSize)}
                  </button>
                  <button
                    onClick={() => {
                      importFull().catch((err) =>
                        console.error('[word bank full import]', err),
                      );
                    }}
                    disabled={!bank || bank.length === 0}
                    title="Import the whole level as one set — play all words"
                    className="rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold text-white transition hover:border-neon-cyan/60 hover:text-neon-cyan active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    ⬇ Play all {bank ? '(' + bank.length.toLocaleString() + ')' : ''}
                  </button>
                </div>
              </div>

              {/* Virtualized preview */}
              <div className="px-6 py-4">
                <div className="mb-2 text-[11px] uppercase tracking-wider text-slate-500">
                  Preview — all {filtered.length.toLocaleString()} words (scroll to browse)
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
                        <span className="text-slate-400">{translation}</span>
                      </div>
                    )}
                  />
                )}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
