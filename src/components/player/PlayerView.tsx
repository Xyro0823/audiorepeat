'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ProfileDropdown from '@/components/auth/ProfileDropdown';
import StreakBadge from '@/components/StreakBadge';
import { useAudioLoop } from '@/hooks/useAudioLoop';
import { usePracticeStats } from '@/hooks/usePracticeStats';
import { useQuizMode } from '@/hooks/useQuizMode';
import { useDictationMode } from '@/hooks/useDictationMode';
import { useLists } from '@/hooks/useLists';
import { useSpeechVoices } from '@/hooks/useSpeechVoices';
import { CachedAudioEngine } from '@/lib/tts/cachedAudioEngine';
import { SpeechSynthesisEngine } from '@/lib/tts/speechSynthesisEngine';
import { findLanguage } from '@/lib/languages';
import { formatCountdown } from '@/lib/format';
import { recordSetPlayed } from '@/lib/libraryMeta';
import type { TTSEngine } from '@/lib/tts/engine';
import type { AppSettings, MasteryStatus } from '@/types/app';
import DictationCard from './DictationCard';
import PlayerControls from './PlayerControls';
import ProgressBar from './ProgressBar';
import QuizCard from './QuizCard';
import SettingsButton from '@/components/settings/SettingsButton';
import SettingsPanel from './SettingsPanel';
import WordCard from './WordCard';

type WordFilter = 'all' | 'learning' | 'hard';

const SLEEP_FADE_MS = 15_000;
const SNOOZE_MS = 30_000; // after the timer ends, Play within this window restarts it

export default function PlayerView({ setId }: { setId: string | null }) {
  const router = useRouter();
  const { sets, loading, settings, saveSettings, saveSet } = useLists();
  const set = sets.find((s) => s.id === setId) ?? null;

  // Playlist filter: 'all' = every word, 'learning' = not yet mastered
  // (covers unmarked + review-needed), 'hard' = only words flagged for review.
  const [filter, setFilter] = useState<WordFilter>('all');

  // ---------- sleep timer (transient, not persisted) ----------
  const [sleepMinutes, setSleepMinutes] = useState<number | null>(null);
  const [sleepEndAt, setSleepEndAt] = useState<number | null>(null);
  const [sleepRemaining, setSleepRemaining] = useState<number | null>(null);
  const [snoozeUntil, setSnoozeUntil] = useState<number | null>(null);
  const [snoozeRemaining, setSnoozeRemaining] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  // 1 = full volume; ramps to 0 over the last 15 seconds before the timer ends.
  const fadeVolume =
    sleepEndAt !== null && sleepRemaining !== null
      ? Math.max(0, Math.min(1, sleepRemaining / SLEEP_FADE_MS))
      : 1;

  // Shuffle toggle: randomizes the playback order of the filtered words.
  // `shuffleSeed` changes on every toggle so each new shuffle gives a fresh
  // order; turning shuffle off restores the natural (filtered) order.
  const [shuffle, setShuffle] = useState(false);
  const [shuffleSeed, setShuffleSeed] = useState(0);

  // Filtered order (natural). The 'hard' filter plays only words marked for
  // review — the "Review Hard Words Only" mode.
  const orderedWords = useMemo(() => {
    if (!set) return [];
    const all = set.words.map((w) => ({
      ...w,
      lang: set.lang,
      nativeLang: set.nativeLang,
    }));
    if (filter === 'learning') return all.filter((w) => w.mastery !== 'mastered');
    if (filter === 'hard') return all.filter((w) => w.mastery === 'hard');
    return all;
  }, [set, filter]);

  const words = useMemo(() => {
    if (!shuffle) return orderedWords;
    const arr = [...orderedWords];
    // Deterministic PRNG seeded per toggle (Fisher–Yates): the permutation is
    // stable for the duration of a shuffle, so playback can't reorder mid-run.
    let s = shuffleSeed >>> 0;
    const rand = () => {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      return s / 0x100000000;
    };
    for (let i = arr.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rand() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }, [orderedWords, shuffle, shuffleSeed]);

  const toggleShuffle = useCallback(() => {
    setShuffle((on) => !on);
    setShuffleSeed((s) => s + 1); // fresh order on every toggle
  }, []);

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
      volume: fadeVolume,
      album: set?.name,
      artist: set ? (findLanguage(set.lang)?.label ?? set.lang) : undefined,
      // Lock-screen / hardware Play must honor the snooze window too — forward
      // to the snooze-aware start (defined below) through a stable ref.
      onPlayRequest: () => startPlaybackRef.current(),
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
      recordMs(Date.now() - playingSinceRef.current, set?.lang);
      playingSinceRef.current = null;
    }
  }, [isPlaying, recordMs, set]);

  // Keep partial time even when the tab is hidden (e.g. lock-screen playback).
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden' && playingSinceRef.current !== null) {
        recordMs(Date.now() - playingSinceRef.current, set?.lang);
        playingSinceRef.current = Date.now();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [recordMs, set]);

  // Recently-practiced: stamp the set into the dashboard's "Continue
  // Practice" sidebar whenever playback starts (or resumes).
  useEffect(() => {
    if (isPlaying && set) recordSetPlayed(set);
  }, [isPlaying, set]);

  // Words listened: count each new word that starts playing (not repeats).
  useEffect(() => {
    if (!isPlaying) return;
    // play() always starts fresh at word 0 — reset so the first word of a new
    // session is counted even if it was the last word of the previous one.
    if (progress.wordIndex === 0) lastCountedWordRef.current = null;
    if (lastCountedWordRef.current !== progress.wordIndex) {
      lastCountedWordRef.current = progress.wordIndex;
      recordWords(1, set?.lang);
    }
  }, [isPlaying, progress.wordIndex, recordWords, set]);

  // Flush remaining study time when leaving the player.
  useEffect(
    () => () => {
      if (playingSinceRef.current !== null)
        recordMs(Date.now() - playingSinceRef.current, set?.lang);
    },
    [recordMs, set],
  );

  // ---------- interactive quiz mode ----------
  // Independent of the audio loop — same TTS engine, own question/answer state.
  const [quizOn, setQuizOn] = useState(false);
  const quiz = useQuizMode({
    words,
    engine,
    rate: effective.speed,
    volume: fadeVolume,
    targetVoiceURI: effective.targetVoiceURI,
  });

  // Stale-free handles for the sleep-timer interval (quiz object identity
  // changes every render, so the interval must read them through refs).
  const quizRef = useRef(quiz);
  const quizOnRef = useRef(quizOn);
  useEffect(() => {
    quizRef.current = quiz;
  }, [quiz]);
  useEffect(() => {
    quizOnRef.current = quizOn;
  }, [quizOn]);

  // ---------- dictation & spelling practice ----------
  // Same relationship to the audio loop as quiz mode: exclusive with it and
  // with quiz mode, driven by the shared TTS engine.
  const [dictationOn, setDictationOn] = useState(false);
  const dictation = useDictationMode({
    words,
    engine,
    rate: effective.speed,
    volume: fadeVolume,
    targetVoiceURI: effective.targetVoiceURI,
  });
  const dictationRef = useRef(dictation);
  const dictationOnRef = useRef(dictationOn);
  useEffect(() => {
    dictationRef.current = dictation;
  }, [dictation]);
  useEffect(() => {
    dictationOnRef.current = dictationOn;
  }, [dictationOn]);

  const setSleepTimer = useCallback((minutes: number | null) => {
    // setting a new timer (or turning it off) always dismisses a pending snooze
    setSnoozeUntil(null);
    setSnoozeRemaining(null);
    if (minutes === null) {
      setSleepEndAt(null);
      setSleepRemaining(null);
      setSleepMinutes(null);
    } else {
      setSleepMinutes(minutes);
      setSleepEndAt(Date.now() + minutes * 60_000);
      setSleepRemaining(minutes * 60_000);
    }
  }, []);

  // Countdown + fade + auto-stop. Stops both the loop and an active quiz.
  useEffect(() => {
    if (sleepEndAt === null) return;
    const id = window.setInterval(() => {
      const left = sleepEndAt - Date.now();
      if (left <= 0) {
        setSleepEndAt(null);
        setSleepRemaining(null);
        // Keep sleepMinutes: Play inside the snooze window restarts the timer
        // at the same duration.
        setSnoozeUntil(Date.now() + SNOOZE_MS);
        setSnoozeRemaining(SNOOZE_MS);
        stop();
        if (quizOnRef.current) quizRef.current?.stop();
        if (dictationOnRef.current) dictationRef.current?.stop();
        setToast('🌙 Sleep timer ended — tap Play within 30s to snooze.');
        return;
      }
      setSleepRemaining(left);
    }, 500);
    return () => window.clearInterval(id);
  }, [sleepEndAt, stop]);

  // Snooze window: expires on its own if the user never taps Play.
  useEffect(() => {
    if (snoozeUntil === null) return;
    const id = window.setInterval(() => {
      const left = snoozeUntil - Date.now();
      if (left <= 0) {
        setSnoozeUntil(null);
        setSnoozeRemaining(null);
      } else {
        setSnoozeRemaining(left);
      }
    }, 500);
    return () => window.clearInterval(id);
  }, [snoozeUntil]);

  // Restart the sleep timer at its last duration when playback resumes inside
  // the 30s snooze window (classic snooze behavior).
  const snoozeRestart = useCallback(() => {
    if (snoozeUntil === null || sleepMinutes === null) return;
    if (Date.now() >= snoozeUntil) return;
    setSnoozeUntil(null);
    setSnoozeRemaining(null);
    setSleepEndAt(Date.now() + sleepMinutes * 60_000);
    setSleepRemaining(sleepMinutes * 60_000);
  }, [snoozeUntil, sleepMinutes]);

  // Loop playback that honors the snooze window.
  const startPlayback = useCallback(() => {
    play();
    snoozeRestart();
  }, [play, snoozeRestart]);

  // Stable handle for the lock-screen play request (forwarded into the audio
  // loop's media-session handler, which lives before this callback is defined).
  const startPlaybackRef = useRef(startPlayback);
  useEffect(() => {
    startPlaybackRef.current = startPlayback;
  }, [startPlayback]);

  // Quiz start that honors the snooze window too.
  const startQuiz = useCallback(() => {
    quiz.start();
    snoozeRestart();
  }, [quiz, snoozeRestart]);

  // Dictation start that honors the snooze window too.
  const startDictation = useCallback(() => {
    dictation.start();
    snoozeRestart();
  }, [dictation, snoozeRestart]);

  // User-triggered stop: halts playback AND cancels the sleep timer (a manual
  // stop means "done for now", so the timer must not fire a stale toast later).
  const stopPlayback = useCallback(() => {
    stop();
    if (quizOnRef.current) quizRef.current?.stop();
    if (dictationOnRef.current) dictationRef.current?.stop();
    setSleepTimer(null);
  }, [stop, setSleepTimer]);

  // Auto-dismiss the toast.
  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(id);
  }, [toast]);

  const toggleQuiz = useCallback(() => {
    if (quizOn) {
      setQuizOn(false);
      quiz.stop();
    } else {
      setQuizOn(true);
      if (dictationOn) {
        setDictationOn(false);
        dictation.stop();
      }
      stop(); // halt the loop so both engines never speak at once
      startQuiz();
    }
  }, [quizOn, dictationOn, stop, quiz, dictation, startQuiz]);

  const toggleDictation = useCallback(() => {
    if (dictationOn) {
      setDictationOn(false);
      dictation.stop();
    } else {
      setDictationOn(true);
      if (quizOn) {
        setQuizOn(false);
        quiz.stop();
      }
      stop(); // halt the loop so only dictation speaks
      startDictation();
    }
  }, [dictationOn, quizOn, stop, dictation, quiz, startDictation]);

  // Count each quiz/dictation question as a word listened (keeps streak/stats honest).
  useEffect(() => {
    if (quizOn && quiz.question) recordWords(1, set?.lang);
  }, [quizOn, quiz.question, recordWords, set]);
  useEffect(() => {
    if (dictationOn && dictation.item) recordWords(1, set?.lang);
  }, [dictationOn, dictation.item, recordWords, set]);

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
            if (quiz.finished || (!quiz.active && !quiz.question)) startQuiz();
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
            stopPlayback();
            break;
          default:
            break;
        }
        return;
      }
      if (dictationOn) {
        // Typing happens in the input (tag check above skips INPUT), so Space
        // here means "re-sound the word" — the same as ArrowLeft.
        switch (e.code) {
          case 'Space':
          case 'ArrowLeft':
            e.preventDefault();
            dictation.replay();
            break;
          case 'ArrowRight':
            e.preventDefault();
            dictation.skip();
            break;
          case 'KeyS':
            e.preventDefault();
            stopPlayback();
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
          else startPlayback();
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
          stopPlayback();
          break;
        default:
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isPlaying, startPlayback, pause, startQuiz, stopPlayback, skipNext, replayWord, quizOn, quiz, dictationOn, dictation]);

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
      {toast && (
        <div className="animate-fade-up mb-4 rounded-xl border border-neon-amber/40 bg-neon-amber/10 px-4 py-3 text-sm text-neon-amber">
          {toast}
        </div>
      )}
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
        <SettingsButton />
        <ProfileDropdown
          onLeaderboard={() => router.push('/')}
          onSubtitles={() => router.push('/')}
          onBrowse={() => router.push('/')}
        />
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

        <button
          onClick={toggleDictation}
          disabled={words.length === 0}
          aria-pressed={dictationOn}
          title={
            words.length === 0
              ? 'No words to dictate with this filter'
              : 'Hear a word with its spelling hidden, then type what you hear'
          }
          className={`rounded-full border px-3 py-1.5 text-xs font-medium transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 ${
            dictationOn
              ? 'border-neon-violet/60 bg-neon-violet/15 text-neon-violet'
              : 'border-white/10 bg-white/5 text-slate-400 hover:border-neon-violet/40 hover:text-white'
          }`}
        >
          <svg
            viewBox="0 0 24 24"
            className="mr-1 inline h-3.5 w-3.5 -translate-y-px"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4 7V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-4l-4 3v-3H6a2 2 0 0 1-2-2v-1" />
            <path d="M12 4v8" />
          </svg>
          Dictation
        </button>

        {sleepEndAt !== null && sleepRemaining !== null && (
          <button
            onClick={() => setSleepTimer(null)}
            title="Sleep timer active — tap to cancel"
            className="rounded-full border border-neon-amber/40 bg-neon-amber/10 px-3 py-1.5 text-xs font-medium text-neon-amber transition hover:border-neon-amber/70 hover:bg-neon-amber/20 active:scale-95"
          >
            🌙 {formatCountdown(sleepRemaining)}
          </button>
        )}
        {snoozeUntil !== null && snoozeRemaining !== null && (
          <button
            onClick={() => {
              setSnoozeUntil(null);
              setSnoozeRemaining(null);
            }}
            title="Tap Play within 30s to restart the timer, or tap here to dismiss"
            className="rounded-full border border-neon-amber/40 bg-neon-amber/10 px-3 py-1.5 text-xs font-medium text-neon-amber transition hover:border-neon-amber/70 hover:bg-neon-amber/20 active:scale-95"
          >
            ⏰ Snooze {formatCountdown(snoozeRemaining)}
          </button>
        )}
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
            onRestart={startQuiz}
          />
        ) : dictationOn ? (
          <DictationCard
            item={dictation.item}
            listening={dictation.listening}
            input={dictation.input}
            feedback={dictation.feedback}
            revealedWord={dictation.revealedWord}
            correctCount={dictation.correctCount}
            total={dictation.total}
            finished={dictation.finished}
            wordCount={words.length}
            showHints={effective.showHints}
            onInputChange={dictation.setInput}
            onCheck={dictation.check}
            onReveal={dictation.reveal}
            onReplay={dictation.replay}
            onSkip={dictation.skip}
            onRestart={startDictation}
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
              showHints={effective.showHints}
              showExamples={effective.showExamples}
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
        sleepMinutes={sleepMinutes}
        sleepRemaining={sleepRemaining}
        onSleepChange={setSleepTimer}
        voices={voices}
        voicesLoading={voicesLoading}
        targetLang={set.lang}
        nativeLang={set.nativeLang}
      />

      <PlayerControls
        isPlaying={dictationOn ? dictation.active : quizOn ? quiz.active : isPlaying}
        onPlayPause={
          dictationOn
            ? () => {
                if (dictation.finished || (!dictation.active && !dictation.item)) startDictation();
                else if (dictation.active) dictation.pause();
                else dictation.replay(); // paused mid-word → re-sound it
              }
            : quizOn
              ? () => {
                  if (quiz.finished || (!quiz.active && !quiz.question)) startQuiz();
                  else if (quiz.active) quiz.pause();
                  else quiz.replay(); // paused mid-question → re-sound the word
                }
              : isPlaying
                ? pause
                : startPlayback
        }
        onStop={stopPlayback}
        onSkipNext={dictationOn ? dictation.skip : quizOn ? quiz.skip : skipNext}
        onReplay={dictationOn ? dictation.replay : quizOn ? quiz.replay : replayWord}
        speed={effective.speed}
        onSpeedChange={(speed) => changeSettings({ speed })}
        shuffle={shuffle}
        onShuffleToggle={toggleShuffle}
      />
    </main>
  );
}
