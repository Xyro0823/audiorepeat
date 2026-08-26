'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import LanguageLock from './LanguageLock';
import { CEFR_META, LIBRARY_LANGS, PACK_LANG, starterLangLabel } from '@/lib/starterSets';
import {
  getWordBankManifest,
  loadWordBank,
  type WordBankManifest,
  type WordBankWord,
} from '@/lib/vocab/wordBanks';
import { CEFR_LEVELS } from '@/types/app';
import type { CefrLevel, VocabSet } from '@/types/app';
import { useT, type TKey } from '@/lib/i18n';
import useDialogA11y from '@/hooks/useDialogA11y';
import CefrBadge from './CefrBadge';
import TopicLibraryTab from './TopicLibraryTab';
import VirtualList from './VirtualList';

interface Props {
  /** The user's existing sets, used to mark levels already imported. */
  sets: VocabSet[];
  /** Pro gate: the Free plan is limited to 1 active language. */
  pro: boolean;
  /** The Free plan's included language (normalized key) — allows imports in
   *  it even before its starter set has landed. Ignored for Pro. */
  freeLangKey?: string | null;
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
 * Matches word-pack imports (bank-fr-A1, bank-fr-A1-b200, bank-full-fr-A1-…),
 * the legacy curated starter sets (starter-es-ES-A1), and hydrated seed cards
 * (seed-* with a cefr level for a pack language). */
function importedLevelKeys(sets: VocabSet[]): Set<string> {
  const keys = new Set<string>();
  for (const set of sets) {
    const bank = /^bank(?:-full)?-([a-z]{2,3})-([A-C][12])(?:-|$)/.exec(set.id);
    if (bank) {
      keys.add(`${bank[1]}:${bank[2]}`);
      continue;
    }
    const starter = /^starter-([a-z]{2,3})-[A-Z]{2}-([A-C][12])$/.exec(set.id);
    if (starter) {
      keys.add(`${starter[1]}:${starter[2]}`);
      continue;
    }
    // Hydrated home-screen seed cards (seed-*) count as an imported level.
    // Restricted to seed ids so arbitrary user-created sets don't light up ✓.
    if (set.id.startsWith('seed-')) {
      const pack = set.lang ? PACK_LANG[set.lang] : undefined;
      if (pack && set.cefr) keys.add(`${pack}:${set.cefr}`);
    }
  }
  return keys;
}

export default function StarterLibraryModal({ sets, pro, freeLangKey, onClose, onImport }: Props) {
  const t = useT();
  const [tab, setTab] = useState<'cefr' | 'topics'>('cefr');
  const [manifest, setManifest] = useState<WordBankManifest | null>(null);
  const [lang, setLang] = useState<string | null>(null);
  const [level, setLevel] = useState<CefrLevel | null>(null);
  const [bank, setBank] = useState<WordBankWord[] | null>(null);
  const [loading, setLoading] = useState(false);
  /** Stored as a key so the message re-renders in the active locale. */
  const [error, setError] = useState<TKey | null>(null);
  const [query, setQuery] = useState('');
  const [batchSize, setBatchSize] = useState(200);
  /** Shown when a Free user taps import for a language they don't own yet. */
  const [upgradePrompt, setUpgradePrompt] = useState(false);

  // Languages the user already owns sets in, normalized to pack codes (seed
  // sets use BCP-47 tags; bank/topic packs use the bare pack code). Free users
  // may add packs only in languages they already have — anything beyond the
  // first language requires Pro.
  const ownedLangs = useMemo(() => {
    const langs = new Set<string>();
    for (const s of sets) {
      const pack = s.lang ? PACK_LANG[s.lang] : undefined;
      langs.add(pack ?? s.lang);
    }
    return langs;
  }, [sets]);
  const canAddLang = useCallback(
    (packCode: string) => pro || ownedLangs.has(packCode) || freeLangKey === packCode,
    [pro, ownedLangs, freeLangKey],
  );

  // Escape to close
  const dialogRef = useDialogA11y<HTMLDivElement>(true, onClose);

  // Load the manifest once; default to the first language that has a pack.
  useEffect(() => {
    let alive = true;
    getWordBankManifest()
      .then((m) => {
        if (!alive) return;
        setManifest(m);
        const first = LIBRARY_LANGS.map((code) => PACK_LANG[code]).find((code) => m[code]);
        if (first) setLang(first);
      })
      .catch(() => {
        if (alive) setError('library.starter.errorUnavailable');
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
        setError('library.starter.errorLevel');
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
      if (!canAddLang(lang)) {
        setUpgradePrompt(true);
        return;
      }
      const n = Math.min(size, filtered.length);
      // Random sample without replacement for varied sessions
      const pool = [...filtered];
      const picked: WordBankWord[] = [];
      for (let i = 0; i < n && pool.length > 0; i += 1) {
        const idx = Math.floor(Math.random() * pool.length);
        picked.push(pool.splice(idx, 1)[0]);
      }
      const stamp = Date.now();
      // Reuse an existing *batch* card for this level so re-practicing updates
      // the same home card instead of stacking duplicates — matches both the
      // current bank-{lang}-{level}-b{n} ids and the legacy timestamped ids
      // (bank-{lang}-{level}-{stamp}). Never clobber the full-level or seed
      // card (those use bank-full-… / seed-… ids).
      const priorBatch = sets.find(
        (s) =>
          s.id === `bank-${lang}-${level}-b${n}` ||
          (s.id.startsWith(`bank-${lang}-${level}-`) && !s.id.startsWith(`bank-${lang}-${level}-b`)),
      );
      await onImport({
        id: priorBatch?.id ?? `bank-${lang}-${level}-b${n}`,
        name: t('library.starter.setName.batch', {
          lang: starterLangLabel(lang),
          level,
          count: n.toLocaleString(),
        }),
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
    [lang, level, filtered, sets, onImport, canAddLang, t],
  );

  const importFull = useCallback(async () => {
    if (!lang || !level || !bank || bank.length === 0) return;
    if (!canAddLang(lang)) {
      setUpgradePrompt(true);
      return;
    }
    const stamp = Date.now();
    // Replace the corresponding full-level or hydrated seed card (not batch
    // cards — those are separate and practiceBatch manages them) so the home
    // screen shows the full real array length instead of stacking duplicates.
    const existing = sets.find((s) => {
      if (s.id.startsWith(`bank-full-${lang}-${level}`)) return true;
      if (!s.id.startsWith('seed-')) return false;
      const pack = s.lang ? PACK_LANG[s.lang] : undefined;
      return pack === lang && s.cefr === level;
    });
    // Keep the BCP-47 tag when replacing a seed card (e.g. "es-ES", not the
    // pack code "es") so the player's TTS lookup and the library ✓ marker keep
    // working for that level.
    const seedLang = existing?.id.startsWith('seed-') ? existing.lang : undefined;
    await onImport({
      id: existing?.id ?? `bank-full-${lang}-${level}`,
      name: t('library.starter.setName.full', {
        lang: starterLangLabel(lang),
        level,
        count: bank.length.toLocaleString(),
      }),
      lang: seedLang ?? lang,
      nativeLang: 'en-US',
      words: bank.map(([target, translation], i) => ({
        id: 'bkf-' + stamp + '-' + i,
        target,
        translation,
      })),
      cefr: level,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });    }, [lang, level, bank, sets, onImport, canAddLang, t]);

  return (
    <div
      ref={dialogRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={t('library.starter.title')}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="glass animate-fade-up relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <div>
            <h2 className="text-xl font-bold text-white">{t('library.starter.title')}</h2>
            <p className="text-xs text-slate-400">
              {tab === 'topics'
                ? t('library.starter.subtitleTopics')
                : manifest
                  ? t('library.starter.subtitleFull', {
                      langs: Object.keys(manifest).length,
                      words: langTotal.toLocaleString(),
                    })
                  : t('library.starter.subtitlePlain')}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label={t('common.close')}
            className="rounded-lg px-2 py-1 text-slate-400 transition hover:bg-white/5 hover:text-white"
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1.5 border-b border-white/10 px-6 py-2.5">
          {[
            { key: 'cefr', label: t('library.starter.tabCefr') },
            { key: 'topics', label: t('library.starter.tabTopics') },
          ].map((tabItem) => (
            <button
              key={tabItem.key}
              onClick={() => setTab(tabItem.key as 'cefr' | 'topics')}
              className={`rounded-full border px-4 py-1.5 text-xs font-semibold transition ${
                tab === tabItem.key
                  ? 'border-neon-cyan/60 bg-neon-cyan/15 text-neon-cyan'
                  : 'border-white/10 text-slate-400 hover:border-white/25 hover:text-white'
              }`}
            >
              {tabItem.label}
            </button>
          ))}
        </div>

        {tab === 'topics' ? (
          <TopicLibraryTab sets={sets} onImport={onImport} canAddLang={canAddLang} />
        ) : error && !manifest ? (
          <div className="p-10 text-center text-sm text-neon-amber">{t(error)}</div>
        ) : !manifest ? (
          <div className="flex flex-col items-center gap-4 p-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-neon-cyan/30 border-t-neon-cyan" />
            <p className="text-sm text-slate-500">{t('library.starter.loadingLibrary')}</p>
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
                  setUpgradePrompt(false);
                }}
                className={selectClass}
                aria-label={t('common.language')}
              >
                <option value="" disabled>
                  {t('library.pickLanguage')}
                </option>
                {LIBRARY_LANGS.map((code) => {
                  const pack = PACK_LANG[code];
                  const count = manifest[pack]
                    ? Object.values(manifest[pack]).reduce((a, n) => a + (n ?? 0), 0)
                    : 0;
                  return (
                    <option key={code} value={pack}>
                      {canAddLang(pack) ? '' : '🔒 '}
                      {starterLangLabel(code)}
                      {t('library.starter.optionMeta', { count: count.toLocaleString() })}
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
                      title={count > 0 ? t('library.starter.chipCount', { count: count.toLocaleString() }) : t('library.starter.notYet')}
                      className={`inline-flex min-h-9 items-center rounded-full border px-3.5 py-1 text-xs font-semibold transition ${
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
                placeholder={t('library.starter.searchPlaceholder', { lang: lang ? starterLangLabel(lang) : '' })}
                className={`${inputClass} flex-1`}
              />
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] uppercase tracking-wider text-slate-500">{t('library.starter.batch')}</span>
                {BATCH_SIZES.map((n) => (
                  <button
                    key={n}
                    onClick={() => setBatchSize(n)}
                    className={`inline-flex min-h-9 items-center rounded-full border px-3.5 py-1 text-xs font-semibold transition ${
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
                    ? t('library.starter.pickLangBody')
                    : t('library.starter.pickLevelBody')}
                </p>
                {lang && level === null && (
                  <p className="text-xs text-slate-500">
                    {t('library.starter.levelsHint')}
                  </p>
                )}
              </div>
            ) : loading ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-4 p-10">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-neon-cyan/30 border-t-neon-cyan" />
                <p className="text-sm text-slate-500">
                  {t('library.starter.loadingLevel', { count: currentLevelCount.toLocaleString() })}
                </p>
              </div>
            ) : error ? (
              <div className="p-10 text-center text-sm text-neon-amber">{t(error)}</div>
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
                      {query ? t('library.starter.matches') : t('library.starter.wordsInLevel')}
                      {query && (
                        <span>
                          {t('library.starter.ofTotal', { count: bank?.length.toLocaleString() ?? 0 })}
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    {upgradePrompt && <LanguageLock className="w-full animate-fade-up" />}
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
                        {t('library.starter.practiceBatch', { count: Math.min(batchSize, filtered.length) })}
                      </button>
                      <button
                        onClick={() => {
                          importFull().catch((err) =>
                            console.error('[library full import]', err),
                          );
                        }}
                        disabled={!bank || bank.length === 0}
                        title={t('library.starter.playAllTitle')}
                        className="rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold text-white transition hover:border-neon-cyan/60 hover:text-neon-cyan active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {t('library.starter.playAll')}{' '}
                        {bank ? t('library.starter.playAllCount', { count: bank.length.toLocaleString() }) : ''}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Virtualized preview */}
                <div className="flex-1 overflow-y-auto px-6 py-4">
                  <div className="mb-2 text-[11px] uppercase tracking-wider text-slate-500">
                    {t('library.starter.previewHeader', { count: filtered.length.toLocaleString() })}
                  </div>
                  {filtered.length === 0 ? (
                    <div className="rounded-2xl border border-white/10 p-8 text-center text-sm text-slate-400">
                      {t('library.starter.noMatch', { query })}
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
        {tab === 'cefr' && manifest && lang && (
          <div className="border-t border-white/10 px-6 py-3">
            <div className="mb-1 flex items-center justify-between text-xs text-slate-400">
              <span>
                {starterLangLabel(lang)}:{' '}
                {t('library.starter.progressLevels', { imported: importedLevelCount, available: availableLevelCount })}
                {currentLangTotal > 0 && (
                  <span className="text-slate-500">
                    {t('library.starter.progressWords', { count: currentLangTotal.toLocaleString() })}
                  </span>
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
