'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { TTSEngine, TTSEngineVoice } from '@/lib/tts/engine';
import { SpeechSynthesisEngine } from '@/lib/tts/speechSynthesisEngine';
import type { LoopWord } from '@/types/loop';

const FEEDBACK_MS = 1400;

export interface QuizQuestion {
  wordIndex: number;
  word: LoopWord;
  options: string[]; // translation options, shuffled
  correctIndex: number;
}

interface Options {
  words: LoopWord[];
  engine?: TTSEngine;
  rate: number;
  /** 0..1 output level, applied per utterance (sleep-timer fade). Default 1. */
  volume?: number;
  targetVoiceURI?: string;
}

/** SSR-safe no-op engine — speech never starts on the server. */
class NoopEngine implements TTSEngine {
  readonly id = 'noop';
  speak(): void {}
  stop(): void {}
  getVoices(): TTSEngineVoice[] {
    return [];
  }
  loadVoices(): Promise<TTSEngineVoice[]> {
    return Promise.resolve([]);
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

/**
 * Interactive audio quiz: hear the target word, pick its translation from 4
 * options, get instant feedback, then advance. Independent of useAudioLoop —
 * it only shares the TTS engine. Score counts only answered questions.
 */
export function useQuizMode({ words, engine, rate, volume = 1, targetVoiceURI }: Options) {
  const [active, setActive] = useState(false);
  const [question, setQuestion] = useState<QuizQuestion | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [total, setTotal] = useState(0);
  const [finished, setFinished] = useState(false);

  const engineRef = useRef<TTSEngine | null>(null);
  const wordsRef = useRef<LoopWord[]>(words);
  const rateRef = useRef(rate);
  const volumeRef = useRef(volume);
  const voiceRef = useRef(targetVoiceURI);
  const cursorRef = useRef(0);
  const tokenRef = useRef(0);
  const advanceTimerRef = useRef<number | null>(null);
  const questionRef = useRef<QuizQuestion | null>(null);
  const selectedRef = useRef<number | null>(null);
  const finishedRef = useRef(false);

  useEffect(() => {
    wordsRef.current = words;
  }, [words]);
  useEffect(() => {
    rateRef.current = rate;
  }, [rate]);
  useEffect(() => {
    volumeRef.current = volume;
  }, [volume]);
  useEffect(() => {
    voiceRef.current = targetVoiceURI;
  }, [targetVoiceURI]);
  useEffect(() => {
    if (engine && engineRef.current !== engine) {
      engineRef.current?.stop();
      engineRef.current = engine;
    } else if (engine) {
      engineRef.current = engine;
    }
  }, [engine]);

  const getEngine = useCallback((): TTSEngine => {
    if (!engineRef.current) {
      engineRef.current =
        typeof window !== 'undefined' && 'speechSynthesis' in window
          ? new SpeechSynthesisEngine()
          : new NoopEngine();
    }
    return engineRef.current;
  }, []);

  const clearAdvanceTimer = useCallback(() => {
    if (advanceTimerRef.current !== null) {
      clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = null;
    }
  }, []);

  const buildQuestion = useCallback((index: number): QuizQuestion => {
    const list = wordsRef.current;
    const word = list[index];
    const correct = word.translation;
    const distractors = new Set<string>();
    for (const other of shuffle(list)) {
      if (distractors.size >= 3) break;
      if (other.id !== word.id && other.translation !== correct) distractors.add(other.translation);
    }
    const options = shuffle([correct, ...distractors]);
    return { wordIndex: index, word, options, correctIndex: options.indexOf(correct) };
  }, []);

  const speakQuestion = useCallback(
    (token: number, index: number) => {
      const list = wordsRef.current;
      if (list.length === 0 || index >= list.length) {
        finishedRef.current = true;
        setFinished(true);
        setActive(false);
        setQuestion(null);
        return;
      }
      const word = list[index];
      const applyQuestion = () => {
        if (token !== tokenRef.current) return;
        const q = buildQuestion(index);
        questionRef.current = q;
        setQuestion(q);
      };
      getEngine().speak({
        text: word.target,
        lang: word.lang,
        rate: rateRef.current,
        volume: volumeRef.current,
        voiceURI: voiceRef.current,
        onStart: () => {},
        onEnd: applyQuestion,
        onError: () => {
          if (token !== tokenRef.current) return;
          applyQuestion(); // proceed even if audio failed
        },
      });
    },
    [buildQuestion, getEngine],
  );

  const start = useCallback(() => {
    const list = wordsRef.current;
    if (list.length === 0) return;
    tokenRef.current += 1;
    getEngine().stop();
    clearAdvanceTimer();
    // Fresh run (first time or after finishing) resets cursor + score.
    if (finishedRef.current || cursorRef.current >= list.length) {
      cursorRef.current = 0;
      setCorrectCount(0);
      setTotal(0);
    }
    finishedRef.current = false;
    setFinished(false);
    selectedRef.current = null;
    setSelected(null);
    questionRef.current = null;
    setQuestion(null);
    setActive(true);
    speakQuestion(tokenRef.current, cursorRef.current);
  }, [clearAdvanceTimer, getEngine, speakQuestion]);

  const pause = useCallback(() => {
    // Ignore pause mid-feedback: clearing the advance timer while `selected` is
    // set would freeze the question (answer/skip both no-op once answered).
    if (!active || selectedRef.current !== null) return;
    tokenRef.current += 1;
    getEngine().stop();
    clearAdvanceTimer();
    setActive(false);
  }, [active, clearAdvanceTimer, getEngine]);

  const stop = useCallback(() => {
    tokenRef.current += 1;
    getEngine().stop();
    clearAdvanceTimer();
    cursorRef.current = 0;
    setCorrectCount(0);
    setTotal(0);
    selectedRef.current = null;
    setSelected(null);
    questionRef.current = null;
    setQuestion(null);
    finishedRef.current = false;
    setFinished(false);
    setActive(false);
  }, [clearAdvanceTimer, getEngine]);

  const advance = useCallback(
    (token: number) => {
      cursorRef.current += 1;
      const list = wordsRef.current;
      if (cursorRef.current >= list.length) {
        finishedRef.current = true;
        setQuestion(null);
        setSelected(null);
        setFinished(true);
        setActive(false);
        return;
      }
      questionRef.current = null;
      selectedRef.current = null;
      setQuestion(null);
      setSelected(null);
      speakQuestion(token, cursorRef.current);
    },
    [speakQuestion],
  );

  const answer = useCallback(
    (optionIndex: number) => {
      const q = questionRef.current;
      if (!q || selectedRef.current !== null) return;
      // Guard keyboard 1-4 against short option lists (filtered sets < 4 words).
      if (optionIndex < 0 || optionIndex >= q.options.length) return;
      selectedRef.current = optionIndex;
      setSelected(optionIndex);
      const isCorrect = optionIndex === q.correctIndex;
      setCorrectCount((c) => c + (isCorrect ? 1 : 0));
      setTotal((t) => t + 1);
      clearAdvanceTimer();
      advanceTimerRef.current = window.setTimeout(() => {
        advanceTimerRef.current = null;
        tokenRef.current += 1;
        getEngine().stop();
        advance(tokenRef.current);
      }, FEEDBACK_MS);
    },
    [advance, clearAdvanceTimer, getEngine],
  );

  const skip = useCallback(() => {
    if (selectedRef.current !== null) return; // mid-feedback, ignore
    tokenRef.current += 1;
    getEngine().stop();
    clearAdvanceTimer();
    advance(tokenRef.current);
  }, [advance, clearAdvanceTimer, getEngine]);

  const replay = useCallback(() => {
    const q = questionRef.current;
    if (!q) return;
    tokenRef.current += 1;
    getEngine().stop();
    getEngine().speak({
      text: q.word.target,
      lang: q.word.lang,
      rate: rateRef.current,
      volume: volumeRef.current,
      voiceURI: voiceRef.current,
      onStart: () => {},
      onEnd: () => {},
      onError: () => {},
    });
  }, [getEngine]);

  // teardown
  useEffect(
    () => () => {
      tokenRef.current += 1;
      engineRef.current?.stop();
      clearAdvanceTimer();
    },
    [clearAdvanceTimer],
  );

  return {
    active,
    question,
    selected,
    correctCount,
    total,
    finished,
    start,
    pause,
    stop,
    answer,
    skip,
    replay,
  };
}
