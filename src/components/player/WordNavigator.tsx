'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useT } from '@/lib/i18n';
import type { LoopWord } from '@/types/loop';

interface Props {
  open: boolean;
  words: LoopWord[];
  currentIndex: number;
  onSelect: (wordIndex: number) => void;
  onClose: () => void;
}

export default function WordNavigator({ open, words, currentIndex, onSelect, onClose }: Props) {
  const t = useT();
  const [query, setQuery] = useState('');
  const currentButtonRef = useRef<HTMLButtonElement | null>(null);
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const matches = useMemo(
    () => words
      .map((word, index) => ({ word, index }))
      .filter(({ word }) =>
        !normalizedQuery ||
        word.target.toLocaleLowerCase().includes(normalizedQuery) ||
        word.translation.toLocaleLowerCase().includes(normalizedQuery),
      ),
    [normalizedQuery, words],
  );
  const close = useCallback(() => {
    setQuery('');
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const frame = window.requestAnimationFrame(() => {
      currentButtonRef.current?.scrollIntoView({ block: 'center' });
    });
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [close, open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/70 px-0 backdrop-blur-sm sm:items-center sm:px-5"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="word-navigator-title"
        className="flex max-h-[82dvh] w-full flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-night-900 shadow-2xl sm:max-h-[min(78dvh,720px)] sm:max-w-xl sm:rounded-3xl"
      >
        <div className="border-b border-white/10 px-4 pb-4 pt-5 sm:px-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 id="word-navigator-title" className="text-lg font-bold text-white">{t('player.nav.title')}</h2>
              <p className="mt-0.5 text-xs text-slate-500">{t('player.nav.count', { count: words.length })}</p>
            </div>
            <button
              type="button"
              onClick={close}
              aria-label={t('player.nav.closeAria')}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-xl text-slate-300 transition hover:border-neon-cyan/50 hover:text-neon-cyan focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan"
            >
              ×
            </button>
          </div>
          <label className="mt-4 flex h-12 items-center gap-3 rounded-xl border border-white/10 bg-night-950 px-4 focus-within:border-neon-cyan/60 focus-within:ring-2 focus-within:ring-neon-cyan/20">
            <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-slate-500" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-4-4" />
            </svg>
            <span className="sr-only">{t('player.nav.searchSr')}</span>
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('player.nav.searchPlaceholder')}
              className="min-w-0 flex-1 bg-transparent text-base text-white outline-none placeholder:text-slate-600"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="min-h-11 px-1 text-xs font-semibold text-slate-400 hover:text-white"
              >
                {t('player.nav.clear')}
              </button>
            )}
          </label>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain px-2 py-2 sm:px-3" role="listbox" aria-label={t('player.nav.listAria')}>
          {matches.length === 0 ? (
            <div className="flex min-h-40 items-center justify-center px-5 text-center text-sm text-slate-500">
              {t('player.nav.noMatches')}
            </div>
          ) : (
            matches.map(({ word, index }) => {
              const current = index === currentIndex;
              return (
                <button
                  key={word.id}
                  ref={current ? currentButtonRef : undefined}
                  type="button"
                  role="option"
                  aria-selected={current}
                  onClick={() => {
                    onSelect(index);
                    close();
                  }}
                  className={`flex min-h-16 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan ${
                    current
                      ? 'bg-neon-cyan/10 text-neon-cyan'
                      : 'text-slate-200 hover:bg-white/5'
                  }`}
                >
                  <span className={`w-10 shrink-0 text-center text-xs font-semibold ${current ? 'text-neon-cyan' : 'text-slate-600'}`}>
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-base font-semibold">{word.target}</span>
                    <span className="mt-0.5 block truncate text-sm text-slate-500">{word.translation}</span>
                  </span>
                  {current && <span className="shrink-0 text-xs font-semibold">{t('player.nav.playing')}</span>}
                </button>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
