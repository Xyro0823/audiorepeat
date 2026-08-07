'use client';

import type { LoopWord } from '@/types/loop';

interface Props {
  word: LoopWord | null;
  wordIndex: number;
  repeatIndex: number;
  isTranslation: boolean;
  repeats: number;
  total: number;
}

export default function WordCard({ word, wordIndex, repeatIndex, isTranslation, repeats, total }: Props) {
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
      <p className="mb-6 text-xs font-medium uppercase tracking-[0.3em] text-slate-500">
        {isTranslation ? 'Translation' : 'Target'} · {wordIndex + 1} / {total}
      </p>

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
    </div>
  );
}
