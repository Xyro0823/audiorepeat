'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { LoopSettings, LoopWord, PlaybackStatus } from '@/types/loop';
import type { TTSEngine, TTSEngineVoice } from '@/lib/tts/engine';
import { SpeechSynthesisEngine } from '@/lib/tts/speechSynthesisEngine';
import { clampWordIndex, previousWordIndex } from '@/lib/playerNavigation';

const DEFAULT_SETTINGS: LoopSettings = {
  repeats: 2,
  speed: 1,
  targetGapMs: 1000,
  translationGapMs: 900,
  loop: true,
};

interface Cursor {
  wordIndex: number;
  repeatIndex: number; // 0-based repeat of the target currently speaking
  isTranslation: boolean;
}

const IDLE_CURSOR: Cursor = { wordIndex: 0, repeatIndex: 0, isTranslation: false };

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

interface Scheduler {
  speakCurrent: (token: number) => void;
  scheduleNext: () => void;
}

export interface UseAudioLoopOptions {
  words: LoopWord[];
  settings?: Partial<LoopSettings>;
  /** Inject an engine for tests, or the cached/cloud engine for offline hands-free mode. */
  engine?: TTSEngine;
  /** 0..1 output level, applied per utterance (sleep-timer fade). Default 1. */
  volume?: number;
  onWordChange?: (word: LoopWord, index: number) => void;
  /** Lock-screen context: shown as the media-session album (usually the set name). */
  album?: string;
  /** Lock-screen context: shown as the media-session artist (usually the language). */
  artist?: string;
  /**
   * Called when the lock screen / hardware Play is pressed. Defaults to plain
   * `play()`. A host (e.g. the sleep-timer snooze) can route this through its
   * own start logic so media-session Play honors app-level state.
   */
  onPlayRequest?: () => void;
}

/**
 * The audio queue state machine.
 *
 * Playback model per word: [target × repeats, gap, translation, gap] → next word.
 * - Refs are the single source of truth (async speech callbacks must never read stale state).
 * - `tokenRef` invalidates in-flight utterances/timers on stop/pause/skip.
 * - Pause is cancel-based (native speechSynthesis.pause()/resume() is unreliable in
 *   Chromium); resuming re-speaks the current repetition from the start — deliberate,
 *   and actually ideal for drilling.
 * - The scheduler core is two mutually-recursive callbacks that call each other through
 *   `schedulerRef` (updated in an effect), so no stale closures can leak in.
 * - Media Session + Screen Wake Lock are wired here for hands-free control.
 */
export function useAudioLoop({ words, settings = {}, engine, volume = 1, onWordChange, album, artist, onPlayRequest }: UseAudioLoopOptions) {
  const engineRef = useRef<TTSEngine | null>(null);
  const wordsRef = useRef<LoopWord[]>(words);
  const settingsRef = useRef<LoopSettings>({ ...DEFAULT_SETTINGS, ...settings });
  const volumeRef = useRef(volume);
  const cursorRef = useRef<Cursor>({ ...IDLE_CURSOR });
  const tokenRef = useRef(0);
  const gapTimerRef = useRef<number | null>(null);
  const statusRef = useRef<PlaybackStatus>('idle');
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const onWordChangeRef = useRef(onWordChange);
  const mediaMetaRef = useRef({ album: 'AudioRepeat', artist: '' });
  const onPlayRequestRef = useRef<() => void>(() => {});
  const schedulerRef = useRef<Scheduler>({ speakCurrent: () => {}, scheduleNext: () => {} });

  const [status, setStatus] = useState<PlaybackStatus>('idle');
  const [progress, setProgress] = useState<Cursor>({ ...IDLE_CURSOR });

  useEffect(() => {
    onWordChangeRef.current = onWordChange;
  }, [onWordChange]);
  useEffect(() => {
    mediaMetaRef.current = { album: album ?? 'AudioRepeat', artist: artist ?? '' };
  }, [album, artist]);
  useEffect(() => {
    if (engine && engineRef.current !== engine) {
      // engine swap (e.g. cached-audio toggle) mid-playback: stop the old engine
      // and seamlessly re-speak the current step with the new one
      engineRef.current?.stop();
      engineRef.current = engine;
      if (statusRef.current === 'playing') {
        tokenRef.current += 1;
        schedulerRef.current.speakCurrent(tokenRef.current);
      }
    } else if (engine) {
      engineRef.current = engine;
    }
  }, [engine]);
  useEffect(() => {
    settingsRef.current = { ...DEFAULT_SETTINGS, ...settings };
  }, [settings]);
  useEffect(() => {
    volumeRef.current = volume;
  }, [volume]);
  useEffect(() => {
    wordsRef.current = words;
  }, [words]);

  const getEngine = useCallback((): TTSEngine => {
    if (!engineRef.current) {
      engineRef.current =
        typeof window !== 'undefined' && 'speechSynthesis' in window
          ? new SpeechSynthesisEngine()
          : new NoopEngine();
    }
    return engineRef.current;
  }, []);

  const clearGapTimer = useCallback(() => {
    if (gapTimerRef.current !== null) {
      clearTimeout(gapTimerRef.current);
      gapTimerRef.current = null;
    }
  }, []);

  // ---------- wake lock (keep the screen on while drilling hands-free) ----------
  const requestWakeLock = useCallback(async () => {
    try {
      if (typeof navigator !== 'undefined' && 'wakeLock' in navigator) {
        wakeLockRef.current = await navigator.wakeLock.request('screen');
      }
    } catch {
      // denied or unsupported — ignore
    }
  }, []);

  const releaseWakeLock = useCallback(() => {
    wakeLockRef.current?.release().catch(() => {});
    wakeLockRef.current = null;
  }, []);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'visible' && statusRef.current === 'playing') {
        void requestWakeLock();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [requestWakeLock]);

  // ---------- media session (lock screen / bluetooth headphone controls) ----------
  const syncMediaSession = useCallback((state: 'playing' | 'paused' | 'none') => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    const list = wordsRef.current;
    const c = cursorRef.current;
    const word = list[c.wordIndex];
    const { album: metaAlbum, artist: metaArtist } = mediaMetaRef.current;
    try {
      navigator.mediaSession.playbackState = state;
      if (state === 'none' || !word) {
        // Clear the now-playing notification entirely once playback ends, so
        // the lock screen never lingers on a stale word.
        navigator.mediaSession.metadata = null;
        return;
      }
      navigator.mediaSession.metadata = new MediaMetadata({
        title: c.isTranslation ? word.translation : word.target,
        artist: metaArtist
          ? `${metaArtist} · ${c.wordIndex + 1} / ${list.length}`
          : `${c.wordIndex + 1} / ${list.length}`,
        album: metaAlbum,
        artwork: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      });
    } catch {
      // best-effort
    }
  }, []);

  const finish = useCallback(() => {
    tokenRef.current += 1; // invalidate anything in flight
    engineRef.current?.stop();
    clearGapTimer();
    cursorRef.current = { ...IDLE_CURSOR };
    statusRef.current = 'idle';
    setStatus('idle');
    setProgress({ ...IDLE_CURSOR });
    syncMediaSession('none');
    releaseWakeLock();
  }, [clearGapTimer, syncMediaSession, releaseWakeLock]);

  // ---------- scheduler core (mutually recursive via schedulerRef) ----------
  const speakCurrent = useCallback(
    (token: number) => {
      const list = wordsRef.current;
      if (list.length === 0) {
        finish();
        return;
      }
      const c = cursorRef.current;
      if (c.wordIndex >= list.length) {
        finish();
        return;
      }
      const s = settingsRef.current;
      const word = list[c.wordIndex];
      const text = c.isTranslation ? word.translation : word.target;
      const lang = c.isTranslation ? (word.nativeLang ?? navigator.language) : word.lang;
      const voiceURI = c.isTranslation ? s.translationVoiceURI : s.targetVoiceURI;

      getEngine().speak({
        text,
        lang,
        rate: s.speed,
        volume: volumeRef.current,
        voiceURI,
        onStart: () => {
          if (token !== tokenRef.current) return;
          syncMediaSession('playing');
          onWordChangeRef.current?.(
            wordsRef.current[cursorRef.current.wordIndex],
            cursorRef.current.wordIndex,
          );
        },
        onEnd: () => {
          if (token === tokenRef.current) schedulerRef.current.scheduleNext();
        },
        onError: (err) => {
          if (token !== tokenRef.current) return;
          console.error('[useAudioLoop]', err);
          schedulerRef.current.scheduleNext(); // skip the failing step, keep the loop alive
        },
      });
    },
    [finish, getEngine, syncMediaSession],
  );

  const scheduleNext = useCallback(() => {
    const c = cursorRef.current;
    const list = wordsRef.current;
    if (list.length === 0) {
      finish();
      return;
    }
    const s = settingsRef.current;
    const word = list[c.wordIndex];
    const repeats = word?.repeats ?? s.repeats;
    const wasTranslation = c.isTranslation;

    if (wasTranslation) {
      c.wordIndex += 1;
      c.repeatIndex = 0;
      c.isTranslation = false;
    } else {
      c.repeatIndex += 1;
      if (c.repeatIndex >= repeats) {
        c.repeatIndex = 0;
        c.isTranslation = true;
      }
    }

    if (c.wordIndex >= list.length) {
      if (s.loop) {
        c.wordIndex = 0;
        c.repeatIndex = 0;
        c.isTranslation = false;
      } else {
        finish();
        return;
      }
    }

    setProgress({
      wordIndex: c.wordIndex,
      repeatIndex: c.repeatIndex,
      isTranslation: c.isTranslation,
    });
    const gap = wasTranslation ? s.translationGapMs : s.targetGapMs;
    gapTimerRef.current = window.setTimeout(
      () => schedulerRef.current.speakCurrent(tokenRef.current),
      gap,
    );
  }, [finish]);

  // keep the scheduler ref pointing at the latest closures (after render)
  useEffect(() => {
    schedulerRef.current.speakCurrent = speakCurrent;
    schedulerRef.current.scheduleNext = scheduleNext;
  }, [speakCurrent, scheduleNext]);

  // ---------- public controls ----------
  const play = useCallback(() => {
    if (typeof window === 'undefined') return;
    const resuming = statusRef.current === 'paused';
    tokenRef.current += 1;
    getEngine().stop();
    clearGapTimer();

    if (!resuming) cursorRef.current = { ...IDLE_CURSOR };
    statusRef.current = 'playing';
    setStatus('playing');
    setProgress({
      wordIndex: cursorRef.current.wordIndex,
      repeatIndex: cursorRef.current.repeatIndex,
      isTranslation: cursorRef.current.isTranslation,
    });
    void requestWakeLock();
    schedulerRef.current.speakCurrent(tokenRef.current);
  }, [clearGapTimer, getEngine, requestWakeLock]);

  const pause = useCallback(() => {
    if (statusRef.current !== 'playing') return;
    tokenRef.current += 1;
    getEngine().stop();
    clearGapTimer();
    statusRef.current = 'paused';
    setStatus('paused');
    syncMediaSession('paused');
    releaseWakeLock();
    // resuming re-speaks the current repetition from the start (deliberate)
  }, [clearGapTimer, getEngine, releaseWakeLock, syncMediaSession]);

  const stop = useCallback(() => {
    tokenRef.current += 1;
    getEngine().stop();
    clearGapTimer();
    cursorRef.current = { ...IDLE_CURSOR };
    statusRef.current = 'idle';
    setStatus('idle');
    setProgress({ ...IDLE_CURSOR });
    syncMediaSession('none');
    releaseWakeLock();
  }, [clearGapTimer, getEngine, releaseWakeLock, syncMediaSession]);

  const skipNext = useCallback(() => {
    const list = wordsRef.current;
    if (list.length === 0) return;
    tokenRef.current += 1;
    getEngine().stop();
    clearGapTimer();
    const c = cursorRef.current;
    c.wordIndex = (c.wordIndex + 1) % list.length; // wrap, like the loop
    c.repeatIndex = 0;
    c.isTranslation = false;
    setProgress({ ...c });
    if (statusRef.current === 'playing') schedulerRef.current.speakCurrent(tokenRef.current);
  }, [clearGapTimer, getEngine]);

  const skipPrevious = useCallback(() => {
    const list = wordsRef.current;
    if (list.length === 0) return;
    tokenRef.current += 1;
    getEngine().stop();
    clearGapTimer();
    const c = cursorRef.current;
    c.wordIndex = previousWordIndex(c.wordIndex, list.length);
    c.repeatIndex = 0;
    c.isTranslation = false;
    setProgress({ ...c });
    if (statusRef.current === 'playing') schedulerRef.current.speakCurrent(tokenRef.current);
  }, [clearGapTimer, getEngine]);

  const seekToWord = useCallback((requestedIndex: number) => {
    const list = wordsRef.current;
    if (list.length === 0) return;
    tokenRef.current += 1;
    getEngine().stop();
    clearGapTimer();
    const c = cursorRef.current;
    c.wordIndex = clampWordIndex(requestedIndex, list.length);
    c.repeatIndex = 0;
    c.isTranslation = false;
    setProgress({ ...c });
    if (statusRef.current === 'playing') schedulerRef.current.speakCurrent(tokenRef.current);
  }, [clearGapTimer, getEngine]);

  const playFromWord = useCallback((requestedIndex: number) => {
    const list = wordsRef.current;
    if (typeof window === 'undefined' || list.length === 0) return;
    tokenRef.current += 1;
    getEngine().stop();
    clearGapTimer();
    cursorRef.current = {
      wordIndex: clampWordIndex(requestedIndex, list.length),
      repeatIndex: 0,
      isTranslation: false,
    };
    statusRef.current = 'playing';
    setStatus('playing');
    setProgress({ ...cursorRef.current });
    void requestWakeLock();
    schedulerRef.current.speakCurrent(tokenRef.current);
  }, [clearGapTimer, getEngine, requestWakeLock]);

  const replayWord = useCallback(() => {
    // Re-hear the current word from its first repeat.
    const list = wordsRef.current;
    if (list.length === 0) return;
    tokenRef.current += 1;
    getEngine().stop();
    clearGapTimer();
    cursorRef.current.repeatIndex = 0;
    cursorRef.current.isTranslation = false;
    setProgress({ ...cursorRef.current });
    if (statusRef.current === 'playing') schedulerRef.current.speakCurrent(tokenRef.current);
  }, [clearGapTimer, getEngine]);

  // media session action handlers — registered once, feature-detected
  useEffect(() => {
    onPlayRequestRef.current = onPlayRequest ?? play;
  }, [onPlayRequest, play]);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    const set = (action: MediaSessionAction, handler: MediaSessionActionHandler | null) => {
      try {
        navigator.mediaSession.setActionHandler(action, handler);
      } catch {
        // unsupported action — ignore
      }
    };
    set('play', () => onPlayRequestRef.current());
    set('pause', pause);
    set('stop', stop);
    set('nexttrack', skipNext);
    set('previoustrack', skipPrevious);
    // Some hardware/Bluetooth skip buttons emit seek actions instead of track
    // actions — map them onto skip/replay for broader lock-screen support.
    set('seekforward', skipNext);
    set('seekbackward', skipPrevious);
    return () => {
      set('play', null);
      set('pause', null);
      set('stop', null);
      set('nexttrack', null);
      set('previoustrack', null);
      set('seekforward', null);
      set('seekbackward', null);
    };
  }, [play, pause, stop, skipNext, skipPrevious]);

  // keep the cursor in bounds if the list is edited mid-playback
  useEffect(() => {
    wordsRef.current = words;
    if (words.length === 0 && statusRef.current !== 'idle') stop();
    else if (statusRef.current === 'playing' && cursorRef.current.wordIndex >= words.length) stop();
  }, [words, stop]);

  // teardown
  useEffect(
    () => () => {
      tokenRef.current += 1;
      engineRef.current?.stop();
      clearGapTimer();
      releaseWakeLock();
    },
    [clearGapTimer, releaseWakeLock],
  );

  const loadVoices = useCallback(() => getEngine().loadVoices(), [getEngine]);
  const getVoices = useCallback((lang?: string) => getEngine().getVoices(lang), [getEngine]);

  return {
    status,
    progress,
    currentWord: words[progress.wordIndex] ?? null,
    isPlaying: status === 'playing',
    isPaused: status === 'paused',
    play,
    pause,
    stop,
    skipNext,
    skipPrevious,
    seekToWord,
    playFromWord,
    replayWord,
    loadVoices,
    getVoices,
  };
}
