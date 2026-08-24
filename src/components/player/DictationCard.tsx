'use client';

import { emojiForText } from '@/lib/emoji';
import { useT } from '@/lib/i18n';
import type { DictationItem } from '@/hooks/useDictationMode';
import type { DictationFeedback } from '@/hooks/useDictationMode';

interface Props {
  item: DictationItem | null;
  /** True while the word audio is playing (input locked). */
  listening: boolean;
  input: string;
  feedback: DictationFeedback;
  revealedWord: string | null;
  correctCount: number;
  total: number;
  finished: boolean;
  wordCount: number;
  showHints: boolean;
  onInputChange: (v: string) => void;
  onCheck: () => void;
  onReveal: () => void;
  onReplay: () => void;
  onSkip: () => void;
  onRestart: () => void;
}

/** Case/diacritic-insensitive per-character comparison for the live slots. */
function sameChar(a: string, b: string): boolean {
  const fold = (c: string) =>
    c.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return fold(a) === fold(b);
}

function ScoreBadge({ correct, total }: { correct: number; total: number }) {
  const t = useT();
  if (total === 0) return null;
  return (
    <span className="rounded-full border border-neon-violet/30 bg-neon-violet/10 px-2 py-0.5 text-[10px] font-semibold normal-case tracking-normal text-neon-violet">
      {t('player.scoreBadge', { correct, total })}
    </span>
  );
}

export default function DictationCard({
  item,
  listening,
  input,
  feedback,
  revealedWord,
  correctCount,
  total,
  finished,
  wordCount,
  showHints,
  onInputChange,
  onCheck,
  onReveal,
  onReplay,
  onSkip,
  onRestart,
}: Props) {
  const t = useT();
  if (finished) {
    if (total === 0) {
      return (
        <div className="animate-fade-up flex flex-col items-center gap-4 py-6 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-neon-cyan to-neon-violet text-night-950">
            <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 5.5v13a1 1 0 0 0 1.5.87l11-6.5a1 1 0 0 0 0-1.74l-11-6.5A1 1 0 0 0 8 5.5Z" />
            </svg>
          </div>
          <p className="text-2xl font-bold text-white">{t('player.dictation.completeTitle')}</p>
          <p className="max-w-xs text-sm text-slate-400">
            {t('player.dictation.allSkippedBody', { count: wordCount })}
          </p>
          <button
            onClick={onRestart}
            className="mt-2 rounded-xl bg-gradient-to-r from-neon-cyan to-neon-violet px-6 py-2.5 text-sm font-semibold text-night-950 transition hover:brightness-110 active:scale-95"
          >
            {t('player.playAgain')}
          </button>
        </div>
      );
    }
    const pct = Math.round((correctCount / total) * 100);
    return (
      <div className="animate-fade-up flex flex-col items-center gap-4 py-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-neon-green to-neon-cyan text-night-950 shadow-[0_0_30px_rgba(77,255,158,0.35)]">
          <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </div>
        <p className="text-2xl font-bold text-white">{t('player.dictation.completeTitle')}</p>
        <p className="text-5xl font-bold tabular-nums text-neon-violet">
          {correctCount} <span className="text-2xl text-slate-400">/ {total}</span>
        </p>
        <p className="text-sm text-slate-400">{t('player.dictation.pctCorrect', { pct })}</p>
        <button
          onClick={onRestart}
          className="mt-2 rounded-xl bg-gradient-to-r from-neon-cyan to-neon-violet px-6 py-2.5 text-sm font-semibold text-night-950 transition hover:brightness-110 active:scale-95"
        >
          {t('player.playAgain')}
        </button>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="animate-fade-up flex flex-col items-center gap-4 py-10 text-center">
        <div className="flex h-16 w-16 animate-pulse-glow items-center justify-center rounded-full bg-gradient-to-br from-neon-cyan to-neon-violet text-night-950">
          <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 5 6 9H2v6h4l5 4V5Z" />
            <path d="M15.5 8.5a5 5 0 0 1 0 7" />
            <path d="M18.5 5.5a9 9 0 0 1 0 13" />
          </svg>
        </div>
        <p className="text-lg font-semibold text-white">
          {t(listening ? 'player.dictation.listeningTitle' : 'player.dictation.modeTitle')}
        </p>
        <p className="max-w-xs text-sm text-slate-400">
          {listening
            ? t('player.dictation.listeningIntro')
            : t('player.dictation.modeIntro')}
        </p>
      </div>
    );
  }

  const answered = feedback !== null;
  const canCheck = input.trim() !== '' && !answered;
  const emoji = showHints ? emojiForText(item.word.translation) : null;
  const targetChars = item.word.target.split('');

  return (
    <div key={item.wordIndex} className="animate-fade-up flex flex-col items-center text-center">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-slate-500">
        <span>
          {t('player.dictation.itemN', { current: item.wordIndex + 1, total: wordCount })}
        </span>
        <ScoreBadge correct={correctCount} total={total} />
      </div>

      {emoji && (
        <span
          role="img"
          aria-label={t('player.hint.emoji')}
          className="mt-5 text-5xl leading-none drop-shadow-[0_0_18px_rgba(59,130,246,0.35)]"
        >
          {emoji}
        </span>
      )}

      {answered ? (
        <>
          <p
            className={`mt-5 text-4xl font-bold tracking-tight sm:text-5xl ${
              feedback === 'correct'
                ? 'text-neon-green text-glow-cyan'
                : feedback === 'wrong'
                  ? 'text-neon-magenta'
                  : 'text-neon-amber'
            }`}
          >
            {revealedWord}
          </p>
          <p className="mt-3 text-2xl text-slate-400">{item.word.translation}</p>
          <p
            className={`mt-5 text-sm font-semibold ${
              feedback === 'correct' ? 'text-neon-green' : feedback === 'wrong' ? 'text-neon-magenta' : 'text-neon-amber'
            }`}
          >
            {feedback === 'correct'
              ? t('player.dictation.correctFeedback')
              : feedback === 'wrong'
                ? t('player.dictation.wrongFeedback')
                : t('player.dictation.revealedFeedback')}
          </p>
        </>
      ) : (
        <>
          {/* Letter slots — fill in live as the user types. */}
          <div className="mt-6 flex max-w-full flex-wrap items-center justify-center gap-1.5">
            {targetChars.map((ch, i) => {
              const typed = input[i];
              const state = typed === undefined ? 'empty' : sameChar(typed, ch) ? 'ok' : 'bad';
              return (
                <span
                  key={i}
                  className={`flex h-9 w-8 items-center justify-center rounded-lg border text-lg font-bold transition-colors ${
                    state === 'ok'
                      ? 'border-neon-green/60 bg-neon-green/10 text-neon-green'
                      : state === 'bad'
                        ? 'border-neon-magenta/60 bg-neon-magenta/10 text-neon-magenta'
                        : 'border-white/15 bg-white/[0.03] text-slate-500'
                  }`}
                >
                  {typed ?? ''}
                </span>
              );
            })}
          </div>

          <input
            autoFocus
            dir="auto"
            autoCapitalize="none"
            autoCorrect="off"
            autoComplete="off"
            spellCheck={false}
            lang={item.word.lang}
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onCheck();
            }}
            placeholder={t('player.dictation.placeholder')}
            aria-label={t('player.dictation.inputAria')}
            className="mt-6 w-full max-w-sm rounded-xl border border-white/10 bg-night-800/80 px-4 py-3 text-center text-xl text-white outline-none transition placeholder:text-slate-600 focus:border-neon-violet/60 focus:shadow-[0_0_20px_rgba(59,130,246,0.2)]"
          />

          <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
            <button
              onClick={onCheck}
              disabled={!canCheck}
              className="rounded-xl bg-gradient-to-r from-neon-cyan to-neon-violet px-6 py-2.5 text-sm font-semibold text-night-950 transition hover:brightness-110 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {t('player.dictation.check')}
            </button>
            <button
              onClick={onReveal}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-slate-300 transition hover:border-neon-amber/50 hover:text-neon-amber active:scale-95"
            >
              {t('player.dictation.reveal')}
            </button>
            <button
              onClick={onReplay}
              className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-slate-300 transition hover:border-neon-violet/50 hover:text-neon-violet active:scale-95"
            >
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 5 6 9H2v6h4l5 4V5Z" />
                <path d="M15.5 8.5a5 5 0 0 1 0 7" />
                <path d="M18.5 5.5a9 9 0 0 1 0 13" />
              </svg>
              {t('player.dictation.replay')}
            </button>
            <button
              onClick={onSkip}
              className="rounded-xl px-3 py-2.5 text-sm text-slate-500 transition hover:text-white active:scale-95"
            >
              {t('player.dictation.skip')}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
