'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLists } from '@/hooks/useLists';
import { CachedAudioEngine } from '@/lib/tts/cachedAudioEngine';
import { SpeechSynthesisEngine } from '@/lib/tts/speechSynthesisEngine';
import type { TTSEngine } from '@/lib/tts/engine';
import type { VocabSet } from '@/types/app';

const CHALLENGE_SECONDS = 60;
const ADVANCE_MS = 420; // fast feedback — this is a speed game, not a lecture
const BEST_KEY = 'audiorepeat-challenge-best-v1';

interface BestRecord {
  best: number;
  plays: number;
}

interface Round {
  wordIndex: number;
  word: { target: string; translation: string; lang: string };
  options: string[];
  correctIndex: number;
}

function loadBest(setId: string): BestRecord {
  if (typeof window === 'undefined') return { best: 0, plays: 0 };
  try {
    const raw = window.localStorage.getItem(`${BEST_KEY}:${setId}`);
    if (raw) {
      const parsed = JSON.parse(raw) as BestRecord;
      if (parsed && typeof parsed.best === 'number') return parsed;
    }
  } catch {
    /* corrupted — start fresh */
  }
  return { best: 0, plays: 0 };
}

function saveBest(setId: string, rec: BestRecord): void {
  try {
    window.localStorage.setItem(`${BEST_KEY}:${setId}`, JSON.stringify(rec));
  } catch {
    /* storage unavailable */
  }
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

interface Props {
  set: VocabSet | null;
  onClose: () => void;
  /** Called with the number of words answered (keeps streak/stats honest). */
  onRecordWord?: (n: number) => void;
}

export default function SpeedChallenge({ set, onClose, onRecordWord }: Props) {
  const { settings } = useLists();

  const engine = useMemo<TTSEngine>(
    () => {
      const synth = new SpeechSynthesisEngine();
      return settings.cachedAudio ? new CachedAudioEngine(synth) : synth;
    },
    [settings.cachedAudio],
  );

  const [phase, setPhase] = useState<'intro' | 'playing' | 'finished'>('intro');
  const phaseRef = useRef(phase);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);
  const [timeLeft, setTimeLeft] = useState(CHALLENGE_SECONDS);
  const [round, setRound] = useState<Round | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState<BestRecord>(() => (set ? loadBest(set.id) : { best: 0, plays: 0 }));
  const [isNewBest, setIsNewBest] = useState(false);
  const [lastWasCorrect, setLastWasCorrect] = useState<boolean | null>(null);
  const scoreRef = useRef(0);
  const bestRef = useRef(best);

  useEffect(() => {
    scoreRef.current = score;
  }, [score]);
  useEffect(() => {
    bestRef.current = best;
  }, [best]);

  const orderRef = useRef<number[]>([]);
  const cursorRef = useRef(0);
  const endAtRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const tokenRef = useRef(0);
  const roundRef = useRef<Round | null>(null);
  const answeredRef = useRef(false);
  const advanceTimerRef = useRef<number | null>(null);
  const engineRef = useRef<TTSEngine | null>(null);

  useEffect(() => {
    engineRef.current = engine;
    return () => {
      engineRef.current?.stop();
    };
  }, [engine]);

  useEffect(() => {
    roundRef.current = round;
  }, [round]);

  // Lock body scroll while the modal is open.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const buildRound = useCallback(
    (index: number): Round | null => {
      const s = set;
      if (!s || s.words.length === 0) return null;
      const words = s.words;
      const list = orderRef.current;
      if (list.length === 0) return null;
      const idx = list[index % list.length];
      const word = words[idx];
      const correct = word.translation;
      const distractors = new Set<string>();
      for (const other of shuffle(words)) {
        if (distractors.size >= 3) break;
        if (other.id !== word.id && other.translation !== correct) {
          distractors.add(other.translation);
        }
      }
      const options = shuffle([correct, ...distractors]);
      return {
        wordIndex: index,
        word: { target: word.target, translation: word.translation, lang: s.lang },
        options,
        correctIndex: options.indexOf(correct),
      };
    },
    [set],
  );

  const speak = useCallback(
    (text: string, lang: string) => {
      tokenRef.current += 1;
      engineRef.current?.stop();
      engineRef.current?.speak({
        text,
        lang,
        rate: 1, // fair for everyone — the challenge is about translation speed
        volume: 1,
        voiceURI: settings.targetVoiceURI,
        onStart: () => {},
        onEnd: () => {},
        onError: () => {},
      });
    },
    [settings.targetVoiceURI],
  );

  const clearTimers = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (advanceTimerRef.current !== null) {
      clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = null;
    }
  }, []);

  const finish = useCallback(() => {
    tokenRef.current += 1;
    engineRef.current?.stop();
    clearTimers();
    setSelected(null);
    setPhase('finished');
    // Read through refs: the timer interval that fires this may be a stale
    // closure, so the live score/best must come from refs, not state.
    const finalScore = scoreRef.current;
    const prev = bestRef.current;
    const next = { best: Math.max(prev.best, finalScore), plays: prev.plays + 1 };
    bestRef.current = next;
    if (set) saveBest(set.id, next);
    setBest(next);
    setIsNewBest(finalScore > prev.best && finalScore > 0);
  }, [clearTimers, set]);

  const showRound = useCallback(
    (index: number) => {
      const words = set?.words ?? [];
      if (words.length === 0) return;
      const r = buildRound(index);
      if (!r) return;
      roundRef.current = r;
      answeredRef.current = false;
      setRound(r);
      setSelected(null);
      setLastWasCorrect(null);
      speak(r.word.target, r.word.lang);
    },
    [buildRound, set, speak],
  );

  const start = useCallback(() => {
    const words = set?.words ?? [];
    if (words.length === 0) return;
    tokenRef.current += 1;
    engineRef.current?.stop();
    clearTimers();
    // Play the whole set shuffled; wrap around if we cycle faster than 60s.
    orderRef.current = shuffle(words.map((_, i) => i));
    cursorRef.current = 0;      setScore(0);
      scoreRef.current = 0;
      setIsNewBest(false);
      setPhase('playing');
    endAtRef.current = Date.now() + CHALLENGE_SECONDS * 1000;
    setTimeLeft(CHALLENGE_SECONDS);
    showRound(0);
    timerRef.current = window.setInterval(() => {
      const left = endAtRef.current - Date.now();
      if (left <= 0) {
        setTimeLeft(0);
        finish();
        return;
      }
      setTimeLeft(Math.ceil(left / 1000));
    }, 100);
  }, [clearTimers, finish, set, showRound]);

  const advance = useCallback(() => {
    const list = orderRef.current;
    if (list.length === 0) return;
    cursorRef.current += 1;
    if (cursorRef.current >= list.length) cursorRef.current = 0; // keep going
    showRound(cursorRef.current);
  }, [showRound]);

  const answer = useCallback(
    (optionIndex: number) => {
      const r = roundRef.current;
      // Read phase through the ref so a click landing exactly as the clock hits
      // 0 can never score after the timer already saved the result.
      if (!r || answeredRef.current || phaseRef.current !== 'playing') return;
      if (optionIndex < 0 || optionIndex >= r.options.length) return;
      answeredRef.current = true;
      setSelected(optionIndex);
      const correct = optionIndex === r.correctIndex;
      setLastWasCorrect(correct);
      if (correct) setScore((s) => s + 1);
      onRecordWord?.(1);
      advanceTimerRef.current = window.setTimeout(() => {
        advanceTimerRef.current = null;
        tokenRef.current += 1;
        engineRef.current?.stop();
        advance();
      }, ADVANCE_MS);
    },
    [advance, onRecordWord],
  );

  const replay = useCallback(() => {
    const r = roundRef.current;
    if (!r) return;
    speak(r.word.target, r.word.lang);
  }, [speak]);

  const close = useCallback(() => {
    tokenRef.current += 1;
    engineRef.current?.stop();
    clearTimers();
    onClose();
  }, [clearTimers, onClose]);

  // teardown on unmount
  useEffect(
    () => () => {
      tokenRef.current += 1;
      engineRef.current?.stop();
      clearTimers();
    },
    [clearTimers],
  );

  // Escape closes (safe — the timer stops and the score is already saved).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close]);

  if (!set) return null;

  const answered = selected !== null;
  const timerLow = timeLeft <= 10;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-night-950/80 p-4 backdrop-blur-sm">
      <div className="animate-fade-up glass w-full max-w-md rounded-3xl p-6 text-center shadow-[0_0_60px_rgba(167,139,250,0.15)]">
        {phase === 'intro' && (
          <>
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-neon-amber to-neon-magenta text-night-950 shadow-[0_0_30px_rgba(255,201,77,0.35)]">
              <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M13 2 4.5 13.5H11L9.5 22 19 9.5h-6.5L13 2Z" />
              </svg>
            </div>
            <h2 className="mt-4 text-2xl font-bold text-white">1-Minute Challenge</h2>
            <p className="mt-1 text-sm text-slate-400">
              {set.name} · {set.words.length} words
            </p>
            <p className="mx-auto mt-4 max-w-xs text-sm text-slate-400">
              Hear each word and pick its translation as fast as you can — how
              many can you get in {CHALLENGE_SECONDS} seconds?
            </p>
            {best.best > 0 && (
              <p className="mt-3 text-sm font-semibold text-neon-amber">
                ⚡ Personal best: {best.best} · {best.plays} play{best.plays === 1 ? '' : 's'}
              </p>
            )}
            <div className="mt-6 flex gap-2">
              <button
                onClick={start}
                className="flex-1 rounded-xl bg-gradient-to-r from-neon-amber to-neon-magenta px-5 py-3 text-sm font-bold text-night-950 transition hover:brightness-110 active:scale-95"
              >
                ▶ Start
              </button>
              <button
                onClick={close}
                className="rounded-xl border border-white/10 px-5 py-3 text-sm font-medium text-slate-300 transition hover:border-white/25 hover:text-white active:scale-95"
              >
                Close
              </button>
            </div>
          </>
        )}

        {phase === 'playing' && round && (
          <>
            <div className="flex items-center justify-between">
              <span
                className={`rounded-full border px-3 py-1 text-sm font-bold tabular-nums ${
                  timerLow
                    ? 'border-neon-magenta/60 bg-neon-magenta/15 text-neon-magenta animate-pulse-glow'
                    : 'border-neon-cyan/40 bg-neon-cyan/10 text-neon-cyan'
                }`}
              >
                {timeLeft}s
              </span>
              <span className="text-sm font-semibold text-slate-300">
                Score <span className="text-neon-amber">{score}</span>
              </span>
            </div>

            <div className="mt-6 flex items-center justify-center gap-3">
              <div className="flex h-12 w-12 animate-pulse-glow items-center justify-center rounded-full bg-gradient-to-br from-neon-amber to-neon-magenta text-night-950">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 5 6 9H2v6h4l5 4V5Z" />
                  <path d="M15.5 8.5a5 5 0 0 1 0 7" />
                  <path d="M18.5 5.5a9 9 0 0 1 0 13" />
                </svg>
              </div>
              <p className="text-sm text-slate-400">
                {round.wordIndex + 1} · pick the translation
              </p>
              <button
                onClick={replay}
                aria-label="Replay word"
                title="Replay word"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 text-slate-300 transition hover:border-neon-amber/50 hover:text-neon-amber active:scale-90"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 5 6 9H2v6h4l5 4V5Z" />
                  <path d="M15.5 8.5a5 5 0 0 1 0 7" />
                  <path d="M18.5 5.5a9 9 0 0 1 0 13" />
                </svg>
              </button>
            </div>

            <div className="mt-6 grid gap-2 sm:grid-cols-2">
              {round.options.map((option, i) => {
                let cls =
                  'border-white/10 bg-night-800/80 text-slate-200 hover:border-neon-amber/50 hover:text-white active:scale-[0.98]';
                if (answered) {
                  if (i === round.correctIndex)
                    cls = 'border-neon-green/70 bg-neon-green/15 text-neon-green';
                  else if (i === selected) cls = 'border-neon-magenta/70 bg-neon-magenta/15 text-neon-magenta';
                  else cls = 'border-white/5 bg-white/[0.02] text-slate-600';
                }
                return (
                  <button
                    key={i}
                    onClick={() => answer(i)}
                    disabled={answered}
                    className={`rounded-xl border px-4 py-3.5 text-left text-sm font-medium transition ${cls}`}
                  >
                    {option}
                  </button>
                );
              })}
            </div>

            {answered && (
              <p
                className={`mt-4 text-sm font-semibold ${
                  lastWasCorrect ? 'text-neon-green' : 'text-neon-magenta'
                }`}
              >
                {lastWasCorrect
                  ? '✓ Correct!'
                  : `✗ It was "${round.options[round.correctIndex]}"`}
              </p>
            )}
          </>
        )}

        {phase === 'finished' && (
          <>
            <div
              className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full text-night-950 shadow-[0_0_30px_rgba(77,255,158,0.35)] ${
                isNewBest
                  ? 'animate-pulse-glow bg-gradient-to-br from-neon-amber to-neon-magenta'
                  : 'bg-gradient-to-br from-neon-green to-neon-cyan'
              }`}
            >
              <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </div>
            <h2 className="mt-4 text-2xl font-bold text-white">Time&apos;s up!</h2>
            <p className="mt-1 text-5xl font-bold tabular-nums text-neon-amber">
              {score}
            </p>
            <p className="text-sm text-slate-400">correct in 60 seconds</p>
            {isNewBest ? (
              <p className="mt-3 rounded-full border border-neon-amber/40 bg-neon-amber/10 px-4 py-1.5 text-sm font-semibold text-neon-amber">
                🏆 New personal best!
              </p>
            ) : best.best > 0 ? (
              <p className="mt-3 text-sm text-slate-400">
                Best: {best.best} · {best.plays} play{best.plays === 1 ? '' : 's'}
              </p>
            ) : null}
            <div className="mt-6 flex gap-2">
              <button
                onClick={start}
                className="flex-1 rounded-xl bg-gradient-to-r from-neon-amber to-neon-magenta px-5 py-3 text-sm font-bold text-night-950 transition hover:brightness-110 active:scale-95"
              >
                ↻ Play again
              </button>
              <button
                onClick={close}
                className="rounded-xl border border-white/10 px-5 py-3 text-sm font-medium text-slate-300 transition hover:border-white/25 hover:text-white active:scale-95"
              >
                Close
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
