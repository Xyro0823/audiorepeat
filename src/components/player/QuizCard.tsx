'use client';

import type { QuizQuestion } from '@/hooks/useQuizMode';

interface Props {
  question: QuizQuestion | null;
  selected: number | null;
  correctCount: number;
  total: number;
  finished: boolean;
  wordCount: number;
  onAnswer: (optionIndex: number) => void;
  onReplay: () => void;
  onRestart: () => void;
}

function OptionButton({
  text,
  index,
  state,
  onAnswer,
}: {
  text: string;
  index: number;
  state: 'idle' | 'correct' | 'wrong' | 'dim';
  onAnswer: (optionIndex: number) => void;
}) {
  const classes =
    state === 'correct'
      ? 'border-neon-green/70 bg-neon-green/15 text-neon-green shadow-[0_0_16px_rgba(77,255,158,0.2)]'
      : state === 'wrong'
        ? 'border-neon-magenta/70 bg-neon-magenta/15 text-neon-magenta'
        : state === 'dim'
          ? 'border-white/5 bg-white/[0.02] text-slate-600'
          : 'border-white/10 bg-night-800/80 text-slate-200 hover:border-neon-cyan/50 hover:text-white active:scale-[0.98]';
  return (
    <button
      onClick={() => onAnswer(index)}
      disabled={state !== 'idle'}
      className={`flex items-center gap-2.5 rounded-xl border px-4 py-3 text-left text-sm font-medium transition ${classes}`}
    >
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-white/20 text-[10px] font-bold opacity-70">
        {index + 1}
      </span>
      <span className="truncate">{text}</span>
    </button>
  );
}

export default function QuizCard({
  question,
  selected,
  correctCount,
  total,
  finished,
  wordCount,
  onAnswer,
  onReplay,
  onRestart,
}: Props) {
  if (finished) {
    if (total === 0) {
      return (
        <div className="animate-fade-up flex flex-col items-center gap-4 py-6 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-neon-violet to-neon-magenta text-night-950">
            <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M13 2 4.5 13.5H11L9.5 22 19 9.5h-6.5L13 2Z" />
            </svg>
          </div>
          <p className="text-2xl font-bold text-white">Quiz complete!</p>
          <p className="max-w-xs text-sm text-slate-400">
            All {wordCount} questions were skipped. Try answering next time — you get instant feedback on every word.
          </p>
          <button
            onClick={onRestart}
            className="mt-2 rounded-xl bg-gradient-to-r from-neon-cyan to-neon-violet px-6 py-2.5 text-sm font-semibold text-night-950 transition hover:brightness-110 active:scale-95"
          >
            ▶ Play again
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
        <p className="text-2xl font-bold text-white">Quiz complete!</p>
        <p className="text-5xl font-bold tabular-nums text-neon-cyan">
          {correctCount} <span className="text-2xl text-slate-400">/ {total}</span>
        </p>
        <p className="text-sm text-slate-400">{pct}% correct</p>
        <button
          onClick={onRestart}
          className="mt-2 rounded-xl bg-gradient-to-r from-neon-cyan to-neon-violet px-6 py-2.5 text-sm font-semibold text-night-950 transition hover:brightness-110 active:scale-95"
        >
          ▶ Play again
        </button>
      </div>
    );
  }

  if (!question) {
    return (
      <div className="animate-fade-up flex flex-col items-center gap-4 py-10 text-center">
        <div className="flex h-16 w-16 animate-pulse-glow items-center justify-center rounded-full bg-gradient-to-br from-neon-magenta to-neon-violet text-night-950">
          <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 8v4l2.5 2.5" />
          </svg>
        </div>
        <p className="text-lg font-semibold text-white">Quiz mode</p>
        <p className="max-w-xs text-sm text-slate-400">
          Press play to hear a word, then pick its translation from the choices.
        </p>
      </div>
    );
  }

  const answered = selected !== null;
  const isCorrect = answered && selected === question.correctIndex;

  return (
    <div className="animate-fade-up flex flex-col items-center text-center">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-slate-500">
        <span>
          Question {question.wordIndex + 1} / {wordCount}
        </span>
        <span className="rounded-full border border-neon-green/30 bg-neon-green/10 px-2 py-0.5 text-[10px] font-semibold normal-case tracking-normal text-neon-green">
          {correctCount}/{total} correct
        </span>
      </div>

      <p className="mt-6 text-5xl font-bold tracking-tight text-neon-magenta text-glow-magenta sm:text-6xl">
        {question.word.target}
      </p>
      <p className="mt-3 text-xs uppercase tracking-widest text-slate-500">Pick the translation</p>

      <div className="mt-6 grid w-full max-w-md gap-2 sm:grid-cols-2">
        {question.options.map((option, i) => {
          let state: 'idle' | 'correct' | 'wrong' | 'dim' = 'idle';
          if (answered) {
            if (i === question.correctIndex) state = 'correct';
            else if (i === selected) state = 'wrong';
            else state = 'dim';
          }
          return <OptionButton key={i} text={option} index={i} state={state} onAnswer={onAnswer} />;
        })}
      </div>

      {answered && (
        <p
          className={`mt-5 text-sm font-semibold ${
            isCorrect ? 'text-neon-green' : 'text-neon-magenta'
          }`}
        >
          {isCorrect
            ? 'Correct! ✓'
            : `✗ It was "${question.options[question.correctIndex]}"`}
        </p>
      )}

      <button
        onClick={onReplay}
        className="mt-6 flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-medium text-slate-300 transition hover:border-neon-magenta/50 hover:text-neon-magenta active:scale-95"
      >
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 5 6 9H2v6h4l5 4V5Z" />
          <path d="M15.5 8.5a5 5 0 0 1 0 7" />
          <path d="M18.5 5.5a9 9 0 0 1 0 13" />
        </svg>
        Replay word
      </button>
    </div>
  );
}
