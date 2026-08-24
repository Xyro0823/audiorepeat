'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import LanguageLock from './LanguageLock';
import { packLangLabel } from '@/lib/starterSets';
import {
  getTopicManifest,
  loadTopic,
  type TopicManifest,
  type WordBankWord,
} from '@/lib/vocab/wordBanks';
import type { VocabSet } from '@/types/app';
import { useT, type TKey } from '@/lib/i18n';
import VirtualList from './VirtualList';

const ROW_HEIGHT = 44;

interface Props {
  /** Existing sets, used to mark topics already imported. */
  sets: VocabSet[];
  /** Pro gate: true when the Free user may import this language (already owned). */
  canAddLang: (lang: string) => boolean;
  onImport: (set: VocabSet) => void | Promise<void>;
}

export default function TopicLibraryTab({ sets, canAddLang, onImport }: Props) {
  const t = useT();
  const [manifest, setManifest] = useState<TopicManifest | null>(null);
  const [topic, setTopic] = useState<string | null>(null);
  const [lang, setLang] = useState<string | null>(null);
  const [bank, setBank] = useState<WordBankWord[] | null>(null);
  const [loading, setLoading] = useState(false);
  /** Stored as a key so the message re-renders in the active locale. */
  const [error, setError] = useState<TKey | null>(null);
  /** Shown when a Free user taps import for a language they don't own yet. */
  const [upgradePrompt, setUpgradePrompt] = useState(false);

  useEffect(() => {
    let alive = true;
    getTopicManifest()
      .then((m) => {
        if (alive) setManifest(m);
      })
      .catch(() => {
        if (alive) setError('library.topics.errorUnavailable');
      });
    return () => {
      alive = false;
    };
  }, []);

  // Load the selected topic+language's words
  useEffect(() => {
    let alive = true;
    void (async () => {
      if (!topic || !lang) {
        setBank(null);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const data = await loadTopic(topic);
        if (!alive) return;
        setBank(data?.[lang] ?? []);
      } catch {
        if (!alive) return;
        setError('library.topics.errorLoad');
        setBank(null);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [topic, lang]);

  const importedTopics = useMemo(() => {
    const keys = new Set<string>();
    for (const s of sets) {
      const m = /^topic-([a-z]+)-([a-z]{2})$/.exec(s.id);
      if (m) keys.add(`${m[1]}:${m[2]}`);
    }
    return keys;
  }, [sets]);

  const selectedMeta = manifest && topic ? manifest[topic] : null;
  const langs = selectedMeta ? Object.keys(selectedMeta.langs) : [];

  const importTopic = useCallback(async () => {
    if (!topic || !lang || !bank || bank.length === 0) return;
    if (!canAddLang(lang)) {
      setUpgradePrompt(true);
      return;
    }
    const stamp = Date.now();
    // Deterministic id: re-importing replaces the same home card.
    const existing = sets.find((s) => s.id === `topic-${topic}-${lang}`);
    await onImport({
      id: existing?.id ?? `topic-${topic}-${lang}`,
      name: `${selectedMeta?.label ?? topic} · ${packLangLabel(lang)} (${bank.length} words)`,
      lang,
      nativeLang: 'en-US',
      words: bank.map(([target, translation], i) => ({
        id: `tp-${stamp}-${i}`,
        target,
        translation,
      })),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  }, [topic, lang, bank, sets, onImport, selectedMeta, canAddLang]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-6 py-4">
      {error && !manifest ? (
        <div className="p-10 text-center text-sm text-neon-amber">{t(error)}</div>
      ) : !manifest ? (
        <div className="flex flex-col items-center gap-4 p-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-neon-cyan/30 border-t-neon-cyan" />
          <p className="text-sm text-slate-500">{t('library.topics.loadingTopics')}</p>
        </div>
      ) : (
        <>
          {/* Topic cards */}
          <div className="grid gap-2.5 sm:grid-cols-2">
            {Object.entries(manifest).map(([id, meta]) => {
              const totalWords = Object.values(meta.langs).reduce((a, n) => a + n, 0);
              const active = topic === id;
              return (
                <button
                  key={id}
                  onClick={() => {
                    setTopic(active ? null : id);
                    setLang(null);
                    setBank(null);
                  }}
                  className={`group rounded-2xl border p-4 text-left transition active:scale-[0.98] ${
                    active
                      ? 'border-neon-cyan/60 bg-neon-cyan/10'
                      : 'border-white/10 bg-white/[0.03] hover:border-neon-cyan/40 hover:bg-white/[0.06]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#141433] to-night-950 text-lg">
                      {meta.emoji}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-white">
                        {meta.label}
                      </span>
                      <span className="block text-[11px] text-slate-500">
                        {t('library.topics.cardMeta', { words: totalWords, langs: Object.keys(meta.langs).length })}
                      </span>
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Language chips for the selected topic */}
          {topic && (
            <>
              <p className="mb-2 mt-5 text-[11px] font-medium uppercase tracking-wider text-slate-500">
                {t('library.pickLanguage')}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {langs.map((l) => {
                  const count = selectedMeta?.langs[l] ?? 0;
                  const done = importedTopics.has(`${topic}:${l}`);
                  const active = lang === l;
                  const locked = !canAddLang(l);
                  return (
                    <button
                      key={l}
                      onClick={() => {
                        setLang(active ? null : l);
                        setUpgradePrompt(false);
                      }}
                      className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                        active
                          ? 'border-neon-violet/60 bg-neon-violet/15 text-neon-violet'
                          : 'border-white/10 text-slate-400 hover:border-white/25 hover:text-white'
                      }`}
                    >
                      {packLangLabel(l)}
                      {locked && (
                        <span aria-hidden title={t('library.proFeature')} className="ml-1">
                          🔒
                        </span>
                      )}
                      <span className="ml-1 opacity-60">{count}</span>
                      {done && <span className="ml-1 text-neon-green">✓</span>}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {/* Preview + import */}
          {lang &&
            (loading ? (
              <div className="flex flex-col items-center gap-3 p-10">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-neon-cyan/30 border-t-neon-cyan" />
                <p className="text-sm text-slate-500">{t('library.topics.loadingWords')}</p>
              </div>
            ) : error ? (
              <div className="p-10 text-center text-sm text-neon-amber">{t(error)}</div>
            ) : (
              <div className="mt-5">
                {upgradePrompt && <LanguageLock className="animate-fade-up mb-3" />}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs text-slate-500">
                    <span className="font-semibold text-white">{bank?.length ?? 0}</span>{' '}
                    {t('common.words')}
                  </span>
                  <button
                    onClick={() => {
                      importTopic().catch((err) => console.error('[topic import]', err));
                    }}
                    disabled={!bank || bank.length === 0}
                    className="rounded-xl bg-gradient-to-r from-neon-cyan to-neon-violet px-4 py-2 text-sm font-semibold text-night-950 transition hover:brightness-110 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    ⬇ {t('library.topics.importTopic')}
                  </button>
                </div>
                <div className="mt-3 text-[11px] uppercase tracking-wider text-slate-500">
                  {t('library.preview')}
                </div>
                {bank && bank.length > 0 ? (
                  <VirtualList
                    items={bank}
                    height={Math.min(bank.length, 9) * ROW_HEIGHT}
                    rowHeight={ROW_HEIGHT}
                    className="mt-2 rounded-2xl border border-white/10"
                    renderRow={([target, translation]) => (
                      <div className="flex items-center justify-between px-4 text-sm hover:bg-white/5">
                        <span className="font-medium text-white">{target}</span>
                        <span className="truncate pl-4 text-right text-slate-400">{translation}</span>
                      </div>
                    )}
                  />
                ) : (
                  <div className="mt-2 rounded-2xl border border-white/10 p-8 text-center text-sm text-slate-400">
                    {t('library.topics.noWords')}
                  </div>
                )}
              </div>
            ))}
        </>
      )}
    </div>
  );
}
