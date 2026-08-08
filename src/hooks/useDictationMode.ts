'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { NoopEngine } from '@/lib/tts/engine';
import type { TTSEngine } from '@/lib/tts/engine';
import { SpeechSynthesisEngine } from '@/lib/tts/speechSynthesisEngine';
import type { LoopWord } from '@/types/loop';

const FEEDBACK_MS = 2400;

export interface DictationItem {
  wordIndex: number;
  word: LoopWord;
}

export type DictationFeedback = 'correct' | 'wrong' | 'revealed' | null;

interface Options {
  words: LoopWord[];
  engine?: TTSEngine;
  rate: number;
  /** 0..1 output level, applied per utterance (sleep-timer fade). Default 1. */
  volume?: number;
  targetVoiceURI?: string;
}

/**
 * Spelling-normalize typed text: lowercase, strip diacritics, collapse
 * punctuation/whitespace. Keeps letters from every script (\p{L}) so CJK,
 * Arabic, Cyrillic etc. survive the pass instead of being stripped to empty.
 */
function normalizeSpelling(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  if (Math.abs(m - n) > 8) return 9; // far above any tolerance we grant
  const dp = Array.from({ length: m + 1 }, (_, i) => i);
  for (let j = 1; j <= n; j += 1) {
    let prev = dp[0];
    dp[0] = j;
    for (let i = 1; i <= m; i += 1) {
      const tmp = dp[i];
      dp[i] = Math.min(
        dp[i] + 1, // deletion
        dp[i - 1] + 1, // insertion
        prev + (a[i - 1] === b[j - 1] ? 0 : 1), // substitution
      );
      prev = tmp;
    }
  }
  return dp[m];
}

/**
 * Typo-tolerant spelling check. Tiny words must match exactly; longer words
 * allow one or two mistakes (e.g. "resaurant" → "restaurant").
 */
export function isSpellingCorrect(input: string, target: string): boolean {
  const a = normalizeSpelling(input);
  const b = normalizeSpelling(target);
  if (a === b) return true;
  if (a.length === 0 || b.length === 0) return false;
  const shortest = Math.min(a.length, b.length);
  if (shortest <= 3) return false; // "no" vs "ne" must not pass
  const maxDist = Math.min(2, Math.floor(shortest / 4));
  return levenshtein(a, b) <= maxDist;
}

/**
 * Dictation & spelling practice: hear the target word, type what you heard
 * (spelling hidden), get feedback, then advance. Independent of useAudioLoop
 * and useQuizMode — only the TTS engine is shared. Score counts answered
 * words; "reveal" counts as incorrect, "skip" is unscored (like quiz).
 */
export function useDictationMode({ words, engine, rate, volume = 1, targetVoiceURI }: Options) {
  const [active, setActive] = useState(false);
  const [item, setItem] = useState<DictationItem | null>(null);
  const [listening, setListening] = useState(false); // audio playing, input locked
  const [input, setInput] = useState('');
  const [feedback, setFeedback] = useState<DictationFeedback>(null);
  const [revealedWord, setRevealedWord] = useState<string | null>(null);
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
  const itemRef = useRef<DictationItem | null>(null);
  const feedbackRef = useRef<DictationFeedback>(null);
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
    itemRef.current = item;
  }, [item]);
  useEffect(() => {
    feedbackRef.current = feedback;
  }, [feedback]);
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

  const finish = useCallback(() => {
    finishedRef.current = true;
    setFinished(true);
    setActive(false);
    setItem(null);
    setListening(false);
    setInput('');
    setFeedback(null);
    setRevealedWord(null);
  }, []);

  const speakWord = useCallback(
    (token: number, index: number) => {
      const list = wordsRef.current;
      if (list.length === 0 || index >= list.length) {
        finish();
        return;
      }
      const word = list[index];
      setListening(true);
      setItem(null);
      setInput('');
      setFeedback(null);
      setRevealedWord(null);
      const applyItem = () => {
        if (token !== tokenRef.current) return;
        setListening(false);
        const next = { wordIndex: index, word };
        itemRef.current = next;
        setItem(next);
      };
      getEngine().speak({
        text: word.target,
        lang: word.lang,
        rate: rateRef.current,
        volume: volumeRef.current,
        voiceURI: voiceRef.current,
        onStart: () => {},
        onEnd: applyItem,
        onError: () => {
          if (token !== tokenRef.current) return;
          applyItem(); // proceed even if audio failed
        },
      });
    },
    [finish, getEngine],
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
    feedbackRef.current = null;
    setFeedback(null);
    setRevealedWord(null);
    setActive(true);
    speakWord(tokenRef.current, cursorRef.current);
  }, [clearAdvanceTimer, getEngine, speakWord]);

  const advance = useCallback(
    (token: number) => {
      cursorRef.current += 1;
      const list = wordsRef.current;
      if (cursorRef.current >= list.length) {
        finish();
        return;
      }
      speakWord(token, cursorRef.current);
    },
    [finish, speakWord],
  );

  const scheduleAdvance = useCallback(() => {
    clearAdvanceTimer();
    advanceTimerRef.current = window.setTimeout(() => {
      advanceTimerRef.current = null;
      tokenRef.current += 1;
      getEngine().stop();
      advance(tokenRef.current);
    }, FEEDBACK_MS);
  }, [advance, clearAdvanceTimer, getEngine]);

  const check = useCallback(() => {
    const cur = itemRef.current;
    if (!cur || feedbackRef.current !== null) return;
    const typed = input.trim();
    if (typed === '') return;
    const correct = isSpellingCorrect(typed, cur.word.target);
    feedbackRef.current = correct ? 'correct' : 'wrong';
    setFeedback(correct ? 'correct' : 'wrong');
    setRevealedWord(cur.word.target);
    setCorrectCount((c) => c + (correct ? 1 : 0));
    setTotal((t) => t + 1);
    scheduleAdvance();
  }, [input, scheduleAdvance]);

  const reveal = useCallback(() => {
    const cur = itemRef.current;
    if (!cur || feedbackRef.current !== null) return;
    feedbackRef.current = 'revealed';
    setFeedback('revealed');
    setRevealedWord(cur.word.target);
    setTotal((t) => t + 1); // giving up counts as a miss
    scheduleAdvance();
  }, [scheduleAdvance]);

  const skip = useCallback(() => {
    if (feedbackRef.current !== null) return; // mid-feedback, ignore
    tokenRef.current += 1;
    getEngine().stop();
    clearAdvanceTimer();
    advance(tokenRef.current);
  }, [advance, clearAdvanceTimer, getEngine]);

  const pause = useCallback(() => {
    if (!active || feedbackRef.current !== null) return;
    tokenRef.current += 1;
    getEngine().stop();
    clearAdvanceTimer();
    setListening(false);
    setActive(false);
  }, [active, clearAdvanceTimer, getEngine]);

  const stop = useCallback(() => {
    tokenRef.current += 1;
    getEngine().stop();
    clearAdvanceTimer();
    cursorRef.current = 0;
    setCorrectCount(0);
    setTotal(0);
    itemRef.current = null;
    setItem(null);
    setListening(false);
    setInput('');
    feedbackRef.current = null;
    setFeedback(null);
    setRevealedWord(null);
    finishedRef.current = false;
    setFinished(false);
    setActive(false);
  }, [clearAdvanceTimer, getEngine]);

  const replay = useCallback(() => {
    const cur = itemRef.current;
    if (!cur) return;
    tokenRef.current += 1;
    getEngine().stop();
    getEngine().speak({
      text: cur.word.target,
      lang: cur.word.lang,
      rate: rateRef.current,
      volume: volumeRef.current,
      voiceURI: voiceRef.current,
      onStart: () => {},
      onEnd: () => {},
      onError: () => {},
    });
  }, [getEngine]);

  // Exposed input setter: ignore keystrokes once feedback is showing.
  const handleInputChange = useCallback((v: string) => {
    if (feedbackRef.current !== null) return;
    setInput(v);
  }, []);

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
    item,
    listening,
    input,
    feedback,
    revealedWord,
    correctCount,
    total,
    finished,
    setInput: handleInputChange,
    start,
    pause,
    stop,
    check,
    reveal,
    skip,
    replay,
  };
}
