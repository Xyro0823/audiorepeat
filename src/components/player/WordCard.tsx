'use client';

import { emojiForText } from '@/lib/emoji';
import type { MasteryStatus } from '@/types/app';
import type { LoopWord } from '@/types/loop';

interface Props {
  word: LoopWord | null;
  wordIndex: number;
  repeatIndex: number;
  isTranslation: boolean;
  repeats: number;
  total: number;
  showHints: boolean;
  showExamples: boolean;
  onMark: (status: MasteryStatus | undefined) => void;
}

export default function WordCard({
  word,
  wordIndex,
  repeatIndex,
  isTranslation,
  repeats,
  total,
  showHints,
  showExamples,
  onMark,
}: Props) {
  const emoji = word && showHints && !isTranslation ? emojiForText(word.translation) : null;

  if (!word) {
    return (
      <div className="animate-fade-up flex flex-col items-center gap-4 py-10 text-center">
        <div className="flex h-16 w-16 animate-pulse-glow items-center justify-center rounded-full bg-gradient-to-br from-neon-cyan to-neon-violet text-night-950">
          <svg viewBox="0 0 24 24" className="h-7 w-7 translate-x-0.5" fill="currentColor">
            <path d="M8 5.5v13a1 1 0 0 0 1.5.87l11-6.5a1 1 0 0 0 0-1.74l-11-6.5A1 1 0 0 0 8 5.5Z" />
          </svg>
        </div>
        <p className="text-lg font-semibold text-white">Ready when you are</p>
        <p className="max-w-xs text-sm text-slate-400">
          Press play to hear each word repeated in your target language, then its translation.
        </p>
      </div>
    );
  }

  return (
    <div
      key={`${word.id}-${isTranslation ? 't' : 'r'}`}
      className="animate-fade-up flex flex-col items-center text-center"
    >
      <p className="mb-6 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.3em] text-slate-500">
        <span>
          {isTranslation ? 'Translation' : 'Target'} · {wordIndex + 1} / {total}
        </span>
        {word.mastery === 'mastered' && (
          <span className="rounded-full border border-neon-green/40 bg-neon-green/10 px-2 py-0.5 text-[10px] font-semibold normal-case tracking-normal text-neon-green">
            ✓ mastered
          </span>
        )}
        {word.mastery === 'hard' && (
          <span className="rounded-full border border-neon-amber/40 bg-neon-amber/10 px-2 py-0.5 text-[10px] font-semibold normal-case tracking-normal text-neon-amber">
            ★ review
          </span>
        )}
      </p>

      {emoji && (
        <span
          role="img"
          aria-label="Emoji hint"
          className="mb-4 text-5xl leading-none drop-shadow-[0_0_18px_rgba(34,228,255,0.3)]"
        >
          {emoji}
        </span>
      )}

      <p
        className={`text-5xl font-bold tracking-tight sm:text-6xl ${
          isTranslation ? 'text-neon-magenta text-glow-magenta' : 'text-neon-cyan text-glow-cyan'
        }`}
      >
        {isTranslation ? word.translation : word.target}
      </p>

      <p className="mt-5 text-2xl text-slate-400">
        {isTranslation ? word.target : word.translation}
      </p>

      {!isTranslation && showExamples && word.example && (
        <p className="mt-6 max-w-md text-base italic leading-relaxed text-slate-400">
          “{word.example}”
        </p>
      )}

      {!isTranslation && (
        <div className="mt-8 flex items-center gap-2">
          {Array.from({ length: Math.max(1, repeats) }).map((_, i) => (
            <span
              key={i}
              className={`h-2 w-2 rounded-full transition-all duration-300 ${
                i <= repeatIndex
                  ? 'bg-neon-cyan shadow-[0_0_8px_rgba(34,228,255,0.9)]'
                  : 'bg-night-600'
              }`}
            />
          ))}
          <span className="ml-2 text-xs text-slate-500">
            repeat {repeatIndex + 1} / {repeats}
          </span>
        </div>
      )}

      <div className="mt-8 flex items-center gap-3">
        <button
          onClick={() => onMark(word.mastery === 'mastered' ? undefined : 'mastered')}
          aria-pressed={word.mastery === 'mastered'}
          title={word.mastery === 'mastered' ? 'Unmark this word' : 'Mark as known'}
          className={`flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-semibold transition active:scale-95 ${
            word.mastery === 'mastered'
              ? 'border-neon-green/60 bg-neon-green/15 text-neon-green shadow-[0_0_14px_rgba(77,255,158,0.25)]'
              : 'border-white/10 bg-white/5 text-slate-400 hover:border-neon-green/50 hover:text-neon-green'
          }`}
        >
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20 6 9 17l-5-5" />
          </svg>
          Known
        </button>
        <button
          onClick={() => onMark(word.mastery === 'hard' ? undefined : 'hard')}
          aria-pressed={word.mastery === 'hard'}
          title={word.mastery === 'hard' ? 'Unmark this word' : 'Mark for review'}
          className={`flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-semibold transition active:scale-95 ${
            word.mastery === 'hard'
              ? 'border-neon-amber/60 bg-neon-amber/15 text-neon-amber shadow-[0_0_14px_rgba(255,201,77,0.25)]'
              : 'border-white/10 bg-white/5 text-slate-400 hover:border-neon-amber/50 hover:text-neon-amber'
          }`}
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
            <path d="M12 2.5 14.9 8.4l6.4.9-4.6 4.5 1.1 6.3L12 17.3 6.2 20.1l1.1-6.3L2.7 9.3l6.4-.9L12 2.5Z" />
          </svg>
          Review
        </button>
      </div>
    </div>
  );
}
