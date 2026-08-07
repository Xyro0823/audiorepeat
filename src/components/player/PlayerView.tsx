'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import StreakBadge from '@/components/StreakBadge';
import { useAudioLoop } from '@/hooks/useAudioLoop';
import { usePracticeStats } from '@/hooks/usePracticeStats';
import { useQuizMode } from '@/hooks/useQuizMode';
import { useLists } from '@/hooks/useLists';
import { useSpeechVoices } from '@/hooks/useSpeechVoices';
import { CachedAudioEngine } from '@/lib/tts/cachedAudioEngine';
import { SpeechSynthesisEngine } from '@/lib/tts/speechSynthesisEngine';
import { findLanguage } from '@/lib/languages';
import type { TTSEngine } from '@/lib/tts/engine';
import type { AppSettings, MasteryStatus } from '@/types/app';
import PlayerControls from './PlayerControls';
import ProgressBar from './ProgressBar';
import QuizCard from './QuizCard';
import SettingsPanel from './SettingsPanel';
import WordCard from './WordCard';

type WordFilter = 'all' | 'learning' | 'hard';

export default function PlayerView({ setId }: { setId: string | null }) {
  const { sets, loading, settings, saveSettings, saveSet } = useLists();
  const set = sets.find((s) => s.id === setId) ?? null;

  // Playlist filter: 'all' = every word, 'learning' = not yet mastered
  // (covers unmarked + review-needed), 'hard' = only words flagged for review.
  const [filter, setFilter] = useState<WordFilter>('all');

  const words = useMemo(() => {
    if (!set) return [];
    const all = set.words.map((w) => ({ ...w, lang: set.lang, nativeLang: set.nativeLang }));
    if (filter === 'learning') return all.filter((w) => w.mastery !== 'mastered');
    if (filter === 'hard') return all.filter((w) => w.mastery === 'hard');
    return all;
  }, [set, filter]);

  // Single pass over the set to power the filter pill counts.
  const { learningCount, hardCount } = useMemo(() => {
    if (!set) return { learningCount: 0, hardCount: 0 };
    let learning = 0;
    let hard = 0;
    for (const w of set.words) {
      if (w.mastery === 'hard') hard += 1;
      if (w.mastery !== 'mastered') learning += 1;
    }
    return { learningCount: learning, hardCount: hard };
  }, [set]);

  // effective = global settings merged with any per-set overrides. The
  // before-translation gap lives in the 1-5s range; clamp here (not just at
  // load time) so legacy per-set overrides below 1s display and play back
  // consistently with the slider instead of rendering out-of-range.
  const customMode = !!set?.settings;
  const effective = useMemo<AppSettings>(
    () => ({
      ...settings,
      ...set?.settings,
      targetGapMs: Math.min(5000, Math.max(1000, set?.settings?.targetGapMs ?? settings.targetGapMs)),
    }),
    [settings, set],
  );

  const changeSettings = useCallback(
    (patch: Partial<AppSettings>) => {
      if (!set) return;
      if (customMode) {
        void saveSet({ ...set, settings: { ...(set.settings ?? {}), ...patch } });
      } else {
        saveSettings(patch);
      }
    },
    [set, customMode, saveSet, saveSettings],
  );

  const toggleCustom = useCallback(
    (on: boolean) => {
      if (!set) return;
      // turning on snapshots the current effective settings as the set's baseline
      void saveSet({ ...set, settings: on ? { ...effective } : undefined });
    },
    [set, effective, saveSet],
  );

  // Swappable engine: cached <audio> (offline) when enabled, else speechSynthesis.
  const engine = useMemo<TTSEngine | undefined>(() => {
    if (!effective.cachedAudio) return undefined;
    return new CachedAudioEngine(new SpeechSynthesisEngine());
  }, [effective.cachedAudio]);

  const { progress, currentWord, isPlaying, play, pause, stop, skipNext, replayWord } =
    useAudioLoop({
      words,
      settings: effective,
      engine,
      album: set?.name,
      artist: set ? (findLanguage(set.lang)?.label ?? set.lang) : undefined,
    });

  // ---------- daily practice stats (streak, words, study time) ----------
  const { streak, recordWords, recordMs } = usePracticeStats();
  const playingSinceRef = useRef<number | null>(null);
  const lastCountedWordRef = useRef<number | null>(null);

  // Study time: accumulate wall-clock time spent in the 'playing' state.
  useEffect(() => {
    if (isPlaying) {
      playingSinceRef.current = Date.now();
    } else if (playingSinceRef.current !== null) {
      recordMs(Date.now() - playingSinceRef.current);
      playingSinceRef.current = null;
    }
  }, [isPlaying, recordMs]);

  // Keep partial time even when the tab is hidden (e.g. lock-screen playback).
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden' && playingSinceRef.current !== null) {
        recordMs(Date.now() - playingSinceRef.current);
        playingSinceRef.current = Date.now();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [recordMs]);

  // Words listened: count each new word that starts playing (not repeats).
  useEffect(() => {
    if (!isPlaying) return;
    // play() always starts fresh at word 0 — reset so the first word of a new
    // session is counted even if it was the last word of the previous one.
    if (progress.wordIndex === 0) lastCountedWordRef.current = null;
    if (lastCountedWordRef.current !== progress.wordIndex) {
      lastCountedWordRef.current = progress.wordIndex;
      recordWords(1);
    }
  }, [isPlaying, progress.wordIndex, recordWords]);

  // Flush remaining study time when leaving the player.
  useEffect(
    () => () => {
      if (playingSinceRef.current !== null) recordMs(Date.now() - playingSinceRef.current);
    },
    [recordMs],
  );

  // ---------- interactive quiz mode ----------
  // Independent of the audio loop — same TTS engine, own question/answer state.
  const [quizOn, setQuizOn] = useState(false);
  const quiz = useQuizMode({
    words,
    engine,
    rate: effective.speed,
    targetVoiceURI: effective.targetVoiceURI,
  });

  const toggleQuiz = useCallback(() => {
    if (quizOn) {
      setQuizOn(false);
      quiz.stop();
    } else {
      setQuizOn(true);
      stop(); // halt the loop so both engines never speak at once
      quiz.start();
    }
  }, [quizOn, stop, quiz]);

  // Count each quiz question as a word listened (keeps streak/stats honest).
  useEffect(() => {
    if (quizOn && quiz.question) recordWords(1);
  }, [quizOn, quiz.question, recordWords]);

  // Persist a mastery status for the word currently being drilled.
  const markWord = useCallback(
    (status: MasteryStatus | undefined) => {
      if (!set || !currentWord) return;
      void saveSet({
        ...set,
        words: set.words.map((w) =>
          w.id === currentWord.id ? { ...w, mastery: status } : w,
        ),
      });
    },
    [set, currentWord, saveSet],
  );

  const { voices, loading: voicesLoading } = useSpeechVoices(engine);

  // keyboard shortcuts: Space play/pause · ← replay word · → next · S stop
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      if (target?.closest('button')) return; // Space would also click the focused button
      if (e.repeat) return;
      if (quizOn) {
        switch (e.code) {
          case 'Space':
            e.preventDefault();
            if (quiz.finished || (!quiz.active && !quiz.question)) quiz.start();
            else if (quiz.active) quiz.pause();
            else quiz.replay(); // paused mid-question → re-sound the word
            break;
          case 'ArrowLeft':
            e.preventDefault();
            quiz.replay();
            break;
          case 'ArrowRight':
            e.preventDefault();
            quiz.skip();
            break;
          case 'Digit1':
          case 'Numpad1':
            quiz.answer(0);
            break;
          case 'Digit2':
          case 'Numpad2':
            quiz.answer(1);
            break;
          case 'Digit3':
          case 'Numpad3':
            quiz.answer(2);
            break;
          case 'Digit4':
          case 'Numpad4':
            quiz.answer(3);
            break;
          case 'KeyS':
            e.preventDefault();
            quiz.stop();
            break;
          default:
            break;
        }
        return;
      }
      switch (e.code) {
        case 'Space':
          e.preventDefault();
          if (isPlaying) pause();
          else play();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          replayWord();
          break;
        case 'ArrowRight':
          e.preventDefault();
          skipNext();
          break;
        case 'KeyS':
          e.preventDefault();
          stop();
          break;
        default:
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isPlaying, play, pause, stop, skipNext, replayWord, quizOn, quiz]);

  if (loading) {
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-4 px-5">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-neon-cyan/30 border-t-neon-cyan" />
        <p className="text-sm text-slate-500">Loading…</p>
      </main>
    );
  }

  if (!set) {
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-4 px-5 text-center">
        <p className="text-2xl font-semibold text-white">Set not found</p>
        <p className="text-sm text-slate-400">It may have been deleted.</p>
        <Link
          href="/"
          className="mt-2 rounded-xl bg-gradient-to-r from-neon-cyan to-neon-violet px-5 py-2.5 text-sm font-semibold text-night-950 transition hover:brightness-110"
        >
          Back to library
        </Link>
      </main>
    );
  }

  const currentRepeats = currentWord?.repeats ?? effective.repeats;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-5 pb-52 pt-6">
      <header className="animate-fade-up flex items-center gap-2">
        <Link
          href="/"
          className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm text-slate-400 transition hover:bg-white/5 hover:text-white"
          aria-label="Back to library"
        >
          <span>←</span>
          <span>Library</span>
        </Link>
        <span className="text-slate-700">/</span>
        <h1 className="truncate text-sm font-semibold text-slate-200">{set.name}</h1>
        <span className="ml-auto shrink-0 rounded-full border border-white/10 px-2.5 py-0.5 text-[11px] text-slate-400">
          {filter === 'all'
            ? `${set.words.length} words`
            : `${words.length} / ${set.words.length} words`}
        </span>
        <StreakBadge streak={streak} />
      </header>

      <div className="animate-fade-up mt-4 flex flex-wrap items-center gap-1.5">
        {(
          [
            { key: 'all', label: 'All', count: set.words.length },
            { key: 'learning', label: 'Learning', count: learningCount },
            { key: 'hard', label: 'Review', count: hardCount },
          ] as const
        ).map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition active:scale-95 ${
              filter === f.key
                ? 'border-neon-cyan/60 bg-neon-cyan/15 text-neon-cyan'
                : 'border-white/10 bg-white/5 text-slate-400 hover:border-white/25 hover:text-white'
            }`}
          >
            {f.label}
            <span className="ml-1.5 opacity-60">{f.count}</span>
          </button>
        ))}
        {filter !== 'all' && (
          <span className="ml-2 text-[11px] text-slate-500">
            {filter === 'hard' ? 'only words marked for review' : 'only words not yet mastered'}
          </span>
        )}

        <span className="mx-1 hidden h-5 w-px bg-white/10 sm:block" />

        <button
          onClick={toggleQuiz}
          disabled={words.length === 0}
          aria-pressed={quizOn}
          title={
            words.length === 0
              ? 'No words to quiz on with this filter'
              : 'Hear a word, then pick its translation from four choices'
          }
          className={`rounded-full border px-3 py-1.5 text-xs font-medium transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 ${
            quizOn
              ? 'border-neon-magenta/60 bg-neon-magenta/15 text-neon-magenta'
              : 'border-white/10 bg-white/5 text-slate-400 hover:border-neon-magenta/40 hover:text-white'
          }`}
        >
          <svg
            viewBox="0 0 24 24"
            className="mr-1 inline h-3.5 w-3.5 -translate-y-px"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M9.5 8.5 15 12l-5.5 3.5v-7Z" />
          </svg>
          Quiz
        </button>
      </div>

      <div className="flex flex-1 flex-col justify-center py-8">
        {words.length === 0 ? (
          <div className="animate-fade-up flex flex-col items-center gap-3 text-center">
            <p className="text-3xl font-bold text-white">All caught up! 🎉</p>
            <p className="max-w-xs text-sm text-slate-400">
              {filter === 'hard'
                ? 'No words are marked for review. While drilling, tap Review on words you want to revisit.'
                : 'Every word in this set is mastered.'}
            </p>
            <button
              onClick={() => setFilter('all')}
              className="mt-2 rounded-xl bg-gradient-to-r from-neon-cyan to-neon-violet px-5 py-2.5 text-sm font-semibold text-night-950 transition hover:brightness-110 active:scale-95"
            >
              Play all {set.words.length} words
            </button>
          </div>
        ) : quizOn ? (
          <QuizCard
            question={quiz.question}
            selected={quiz.selected}
            correctCount={quiz.correctCount}
            total={quiz.total}
            finished={quiz.finished}
            wordCount={words.length}
            onAnswer={quiz.answer}
            onReplay={quiz.replay}
            onRestart={quiz.start}
          />
        ) : (
          <>
            <WordCard
              word={currentWord}
              wordIndex={progress.wordIndex}
              repeatIndex={progress.repeatIndex}
              isTranslation={progress.isTranslation}
              repeats={currentRepeats}
              total={words.length}
              onMark={markWord}
            />
            <ProgressBar
              wordIndex={progress.wordIndex}
              repeatIndex={progress.repeatIndex}
              isTranslation={progress.isTranslation}
              repeats={currentRepeats}
              total={words.length}
            />
          </>
        )}
      </div>

      <SettingsPanel
        settings={effective}
        onChange={changeSettings}
        customMode={customMode}
        onToggleCustom={toggleCustom}
        voices={voices}
        voicesLoading={voicesLoading}
        targetLang={set.lang}
        nativeLang={set.nativeLang}
      />

      <PlayerControls
        isPlaying={quizOn ? quiz.active : isPlaying}
        onPlayPause={
          quizOn
            ? () => {
                if (quiz.finished || (!quiz.active && !quiz.question)) quiz.start();
                else if (quiz.active) quiz.pause();
                else quiz.replay(); // paused mid-question → re-sound the word
              }
            : isPlaying
              ? pause
              : play
        }
        onStop={quizOn ? quiz.stop : stop}
        onSkipNext={quizOn ? quiz.skip : skipNext}
        onReplay={quizOn ? quiz.replay : replayWord}
        speed={effective.speed}
        onSpeedChange={(speed) => changeSettings({ speed })}
      />
    </main>
  );
}
