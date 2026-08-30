'use client';
import { registerRoute } from "@/lib/i18n/register/route";
registerRoute("player");


import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import ProfileDropdown from '@/components/auth/ProfileDropdown';
import AuthScreen from '@/components/auth/AuthScreen';
import StreakBadge from '@/components/StreakBadge';
import { useAudioLoop } from '@/hooks/useAudioLoop';
import { useAuth } from '@/hooks/useAuth';
import { usePracticeStats } from '@/hooks/usePracticeStats';
import { useQuizMode } from '@/hooks/useQuizMode';
import { useDictationMode } from '@/hooks/useDictationMode';
import { usePlayerSet } from '@/hooks/usePlayerSet';
import { useSpeechVoices } from '@/hooks/useSpeechVoices';
import { CachedAudioEngine } from '@/lib/tts/cachedAudioEngine';
import { CloudTtsEngine } from '@/lib/tts/cloudTtsEngine';
import { cloudAudioActiveFor } from '@/lib/tts/cloudAudioGate';
import { isMongolianLocale } from '@/lib/tts/cloudAccess';
import { shouldOfferCloudVoiceConsent } from '@/lib/tts/cloudVoiceConsent';
import { prewarmKey, requestSetPrewarm } from '@/lib/tts/cloudTts';
import { isIOSWebKit, SpeechSynthesisEngine } from '@/lib/tts/speechSynthesisEngine';
import { findLanguage } from '@/lib/languages';
import { loadWordBank } from '@/lib/vocab/wordBanks';
import {
  createMongolianGlossary,
  mongolianGlossFor,
  type MongolianGlossary,
} from '@/lib/vocab/mongolianGlosses';
import { translateBatchToMongolian } from '@/lib/translator/translate';
import { applyMasteryStatus } from '@/lib/review/fsrs';
import {
  FREE_DAILY_WORD_LIMIT,
  FREE_LANG_LIMIT,
  freeDailyLimitReached,
  planHasFeature,
} from '@/lib/plans';
import { formatCountdown } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { recordSetPlayed } from '@/lib/libraryMeta';
import {
  clearPlaybackPosition,
  readPlaybackPosition,
  savePlaybackPosition,
} from '@/lib/playbackPosition';
import { hasDashboardScrollPosition } from '@/lib/libraryScrollPosition';
import type { TTSEngine } from '@/lib/tts/engine';
import type { AppSettings, MasteryStatus } from '@/types/app';
import type { LoopWord } from '@/types/loop';
import { useCloudTtsStatus } from '@/hooks/useCloudTtsStatus';
import DictationCard from './DictationCard';
import PlayerControls from './PlayerControls';
import ProgressBar from './ProgressBar';
import QuizCard from './QuizCard';
import SettingsButton from '@/components/settings/SettingsButton';
import SettingsPanel from './SettingsPanel';
import WordCard from './WordCard';
import WordNavigator from './WordNavigator';

type WordFilter = 'all' | 'learning' | 'hard';

const SLEEP_FADE_MS = 15_000;
const SNOOZE_MS = 30_000; // after the timer ends, Play within this window restarts it
const LIBRARY_HREF = '/dashboard';

export default function PlayerView({ setId }: { setId: string | null }) {
  const router = useRouter();
  const t = useT();
  const { user } = useAuth();
  // Player-scoped load: only the requested set is read from IndexedDB — the
  // full-library hydration (useLists) stays on the dashboard.
  const { set: loadedSet, loading, settings, saveSettings, saveSet } = usePlayerSet(setId);
  const set = loadedSet;

  // A normal player launch comes from the library. Going back through browser
  // history preserves the already-rendered dashboard and its scroll position,
  // avoiding the visible top-of-page flash from mounting `/dashboard` again.
  // Direct/shared player links have no saved return position and keep the
  // regular dashboard fallback instead.
  const returnToLibrary = useCallback((event: React.MouseEvent<HTMLAnchorElement>) => {
    if (!hasDashboardScrollPosition()) return;
    event.preventDefault();
    router.back();
  }, [router]);

  // Playlist filter: 'all' = every word, 'learning' = not yet mastered
  // (covers unmarked + review-needed), 'hard' = only words flagged for review.
  const [filter, setFilter] = useState<WordFilter>('all');
  const [navigatorOpen, setNavigatorOpen] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [resumeWordId, setResumeWordId] = useState<string | null>(null);
  const lastSavedPositionRef = useRef<string | null>(null);
  const swipeStartRef = useRef<{ x: number; y: number; interactive: boolean } | null>(null);

  // ---------- sleep timer (transient, not persisted) ----------
  const [sleepMinutes, setSleepMinutes] = useState<number | null>(null);
  const [sleepEndAt, setSleepEndAt] = useState<number | null>(null);
  const [sleepRemaining, setSleepRemaining] = useState<number | null>(null);
  const [snoozeUntil, setSnoozeUntil] = useState<number | null>(null);
  const [snoozeRemaining, setSnoozeRemaining] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [cloudAuthOpen, setCloudAuthOpen] = useState(false);
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
  const [mongolianGlossary, setMongolianGlossary] = useState<MongolianGlossary | null>(null);
  const [mongolianCloudCacheState, setMongolianCloudCacheState] = useState<'saving' | 'cached' | null>(null);
  const [translationProgress, setTranslationProgress] = useState<{ done: number; total: number } | null>(null);

  // The public word banks store their canonical meaning in English. When the
  // learner chooses Mongolian explanations, reuse the shipped Mongolian A1
  // meanings so the card AND translation audio switch together.
  useEffect(() => {
    let alive = true;
    if (settings.translationLanguage !== 'mongolian') {
      return () => { alive = false; };
    }
    void loadWordBank('mn', 'A1')
      .then((bank) => {
        if (alive) setMongolianGlossary(bank ? createMongolianGlossary(bank.words) : null);
      })
      .catch(() => {
        if (alive) setMongolianGlossary(null);
      });
    return () => { alive = false; };
  }, [settings.translationLanguage]);

  // Filtered order (natural). The 'hard' filter plays only words marked for
  // review — the "Review Hard Words Only" mode.
  const orderedWords = useMemo(() => {
    if (!set) return [];
    const all = set.words.map((w) => ({
      ...w,
      lang: set.lang,
      nativeLang: set.nativeLang,
    })).map((word) => {
      if (settings.translationLanguage !== 'mongolian') return word;
      // Use the saved cloud translation first. Existing Mongolian-native sets
      // already contain the correct meaning; the small local glossary keeps
      // common legacy words useful until their full translation is saved.
      const gloss = word.translationMn ??
        (set.nativeLang.toLowerCase().startsWith('mn')
          ? word.translation
          : mongolianGlossary && mongolianGlossFor(mongolianGlossary, word.translation));
      return gloss ? { ...word, translation: gloss, nativeLang: 'mn-MN' } : word;
    });
    if (filter === 'learning') return all.filter((w) => w.mastery !== 'mastered');
    if (filter === 'hard') return all.filter((w) => w.mastery === 'hard');
    return all;
  }, [set, filter, mongolianGlossary, settings.translationLanguage]);

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
      // A set snapshot may contain old settings from before the learner
      // upgraded. Account entitlements and the secure-cloud consent always
      // belong to the current account, never to a vocabulary set.
      plan: settings.plan,
      planBilling: settings.planBilling,
      planSource: settings.planSource,
      cloudTts: settings.cloudTts,
      targetGapMs: Math.min(5000, Math.max(1000, set?.settings?.targetGapMs ?? settings.targetGapMs)),
    }),
    [settings, set],
  );

  // Feature entitlements — every gate flows through the canonical matrix in
  // src/lib/plans.ts (planHasFeature). Quiz, spaced-repetition marks/filters,
  // cloud/offline audio and the daily word cap are plan features; the core
  // listening loop, dictation and standard device voices stay Free.
  // Purchases land in settings.plan via the /checkout success flow.
  const canQuiz = planHasFeature(effective.plan, 'quiz');
  const canReview = planHasFeature(effective.plan, 'fsrsReview');
  const canUseAllLangs = planHasFeature(effective.plan, 'allLanguages');
  const canCloudAudio = planHasFeature(effective.plan, 'offlineAudio');
  const cloudTtsReady = useCloudTtsStatus();
  const { voices, loading: voicesLoading, hasVoice } = useSpeechVoices();
  const nativeLangForAudio =
    set?.nativeLang ?? (typeof navigator !== 'undefined' ? navigator.language : 'en-US');
  const targetNeedsCloud = Boolean(set && !voicesLoading && !hasVoice(set.lang));
  const hasMongolianTranslation = words.some((word) => word.nativeLang === 'mn-MN');
  // Browser voice registries can report a stale/remote mn-MN voice that then
  // produces no audio. A Mongolian explanation deliberately uses Azure on
  // Free, so do not let that unreliable browser claim suppress the fallback.
  // The Free cloud allowance applies to Mongolian speech, whether it is the
  // explanation or the target language being learned. The server enforces the
  // same language-only rule and its daily cap.
  const freeMongolianVoice = Boolean(
    !planHasFeature(effective.plan, 'offlineAudio') &&
    (hasMongolianTranslation || (set && isMongolianLocale(set.lang))),
  );
  const signedInMongolianCloud = Boolean(user && freeMongolianVoice);
  const mongolianCloudSignInRequired = freeMongolianVoice && !user;
  const translationNeedsCloud = Boolean(
    set && !voicesLoading && !hasVoice(nativeLangForAudio),
  );
  // The server is the authority for Pro/Lifetime access. Keeping an already
  // signed-in learner on device speech while their local entitlement mirror is
  // still refreshing makes paid cloud audio look broken (especially on mobile
  // browsers whose native voices silently fail). A server rejection still
  // falls back safely, so this never grants cloud synthesis client-side.
  // `/api/tts` itself is the authoritative availability and entitlement
  // check. The lightweight status probe can be stale/blocked on a local
  // Wi-Fi origin, so it must never force a signed-in opted-in learner back to
  // a native voice that has already failed to start.
  const authenticatedCloudEnabled = Boolean(user && effective.cloudTts);
  // Plan-gated cloud audio: user toggles alone can never turn this on for a
  // Free plan, and /api/tts re-enforces the same entitlement server-side.
  const cloudAudioActive = authenticatedCloudEnabled || cloudAudioActiveFor({
    plan: effective.plan,
    // Azure audio is account-protected on the server. A guest has no Firebase
    // token, so sending a Mongolian request would always fail and interrupt
    // playback with a misleading "voice unavailable" error.
    // A signed-in learner with Mongolian content may use the narrow Free
    // Azure path immediately. Do not let a failed /api/tts *status* probe
    // silently drop them back to a browser voice which has already reported
    // itself unusable; the protected synthesis request remains authoritative.
    cloudReady: (cloudTtsReady && Boolean(user)) || signedInMongolianCloud,
    cloudTts: effective.cloudTts,
    cachedAudio: effective.cachedAudio || isIOSWebKit(),
    deviceVoiceMissing: targetNeedsCloud || translationNeedsCloud || freeMongolianVoice,
    freeMongolianTranslation: freeMongolianVoice,
  });
  const cloudVoiceConsentNeeded = shouldOfferCloudVoiceConsent({
    configured: cloudTtsReady && canCloudAudio,
    enabled: effective.cloudTts,
    voicesLoading,
    targetNeedsCloud,
    translationNeedsCloud,
  });
  const upgradeToPro = useCallback(() => {
    void router.push('/checkout?plan=pro');
  }, [router]);

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

  const enableCloudVoice = useCallback(() => {
    // Cloud consent is account-wide. Saving it onto just one custom set would
    // leave other sets (and old snapshots) incorrectly routed to native TTS.
    saveSettings({ cloudTts: true });
    setToast(t('player.toast.cloudEnabled'));
  }, [saveSettings, t]);

  const requestCloudVoice = useCallback(() => {
    if (!canCloudAudio) {
      // Free plan never gets cloud voices (the server rejects synthesis too).
      upgradeToPro();
      return;
    }
    if (user) {
      enableCloudVoice();
      return;
    }
    setCloudAuthOpen(true);
  }, [canCloudAudio, enableCloudVoice, upgradeToPro, user]);

  const toggleCustom = useCallback(
    (on: boolean) => {
      if (!set) return;
      // turning on snapshots the current effective settings as the set's baseline
      void saveSet({ ...set, settings: on ? { ...effective } : undefined });
    },
    [set, effective, saveSet],
  );

  // Swappable engine: cached <audio> (offline) when enabled, and ALWAYS on iOS
  // — speechSynthesis is suspended on iOS lock screens, so real <audio>
  // playback (fed by the prewarm below) is the only hands-free-safe path.
  // Cache misses fall back to speechSynthesis inside CachedAudioEngine.
  const engine = useMemo<TTSEngine | undefined>(() => {
    const device = new SpeechSynthesisEngine();
    if (cloudAudioActive) {
      const paidCloudAudio = planHasFeature(effective.plan, 'offlineAudio');
      return new CachedAudioEngine(
        new CloudTtsEngine(
          device,
          // The API verifies the real entitlement for every request. This
          // avoids a stale local plan downgrading an active Lifetime owner to
          // a failing device voice before the entitlement mirror catches up.
          (lang) => authenticatedCloudEnabled || paidCloudAudio || lang.toLowerCase().startsWith('mn'),
          // A previously saved English translation voice must not prevent the
          // explicitly selected Mongolian explanation from reaching Azure.
          (lang) => !paidCloudAudio && lang.toLowerCase().startsWith('mn'),
          !paidCloudAudio ? setMongolianCloudCacheState : undefined,
        ),
      );
    }
    if (effective.cachedAudio || isIOSWebKit()) return new CachedAudioEngine(device);
    return undefined;
  }, [authenticatedCloudEnabled, cloudAudioActive, effective.cachedAudio, effective.plan]);

  // Background pre-warm: generate + cache audio blobs ahead of the drill so
  // words play through <audio> (lock-screen safe). Runs on iOS by default and
  // whenever the user opts into cached audio; explicit voice picks are skipped
  // (they go through speechSynthesis — Google TTS has its own voices).
  //
  // The warm-up is started EARLIER — SetLibrary triggers it the moment the
  // set is tapped, before this screen mounts — so the shared manager
  // (requestSetPrewarm) dedupes by key: if SetLibrary already started this
  // set+config, this effect just subscribes instead of starting a second
  // queue. subscribe() fires immediately with the current snapshot, so the
  // pill reflects progress made before the player mounted (never 0/Y).
  //
  // Progress visibility: warm-up is best-effort, so the indicator is subtle
  // and purely informational — a small pill near Loop settings that only
  // appears once warm-up has been running long enough to notice (>1.2s, or
  // immediately for large sets), then either disappears silently on full
  // success or shows a brief "x of y cached" summary for a few seconds when
  // some words failed (once per warm-up run).
  const [prewarm, setPrewarm] = useState<{ done: number; total: number } | null>(null);
  const [prewarmSummary, setPrewarmSummary] = useState<string | null>(null);

  const setRef = useRef(set);
  useEffect(() => {
    setRef.current = set;
  }, [set]);
  useEffect(() => {
    const s = setRef.current;
    if (!s || s.words.length === 0) return;
    if (!canCloudAudio && !authenticatedCloudEnabled) return;
    // Lifetime / Pro cloud playback deliberately uses <audio> for every
    // language, not only when the browser claims a voice is missing. Begin
    // warming immediately so the second and following words do not wait for
    // a network round trip after Play.
    if (
      !authenticatedCloudEnabled &&
      !effective.cachedAudio &&
      !isIOSWebKit() &&
      !targetNeedsCloud &&
      !translationNeedsCloud
    ) return;
    const nativeLang =
      s.nativeLang ?? (typeof navigator !== 'undefined' ? navigator.language : undefined);
    let revealed = false;
    let summaryTimer: number | undefined;
    const handle = requestSetPrewarm(s.words, {
      key: prewarmKey(
        s.id,
        s.lang,
        nativeLang,
        effective.targetVoiceURI,
        effective.translationVoiceURI,
      ),
      lang: s.lang,
      nativeLang,
      targetVoiceURI: effective.targetVoiceURI,
      translationVoiceURI: effective.translationVoiceURI,
    });
    const unsubscribe = handle.subscribe((p) => {
      if (p.active) {
        // Only surface the pill once warm-up is slow enough to notice — a
        // fast, fully-successful warm-up should stay completely invisible.
        // `p.total > 0` guards the pre-first-tick window: a run created but
        // not yet ticking reports total=0, and revealing then would flash a
        // misleading "Caching audio… 0/0".
        if (!revealed && p.total > 0 && (p.total > 15 || Date.now() - p.startedAt > 1200))
          revealed = true;
        if (revealed) setPrewarm({ done: p.done, total: p.total });
      } else {
        // Finished (possibly before this component mounted — the snapshot
        // already carries the final counts). Summarize only when some words
        // failed (a partial warm-up means some words fall back to
        // speechSynthesis on the lock screen), and only once per run.
        if (p.failed > 0 && !handle.summaryShown()) {
          handle.markSummaryShown();
          setPrewarmSummary(t('player.prewarm.summary', { done: p.succeeded, total: p.total }));
          summaryTimer = window.setTimeout(() => setPrewarmSummary(null), 4000);
        }
        setPrewarm(null);
      }
    });
    return () => {
      unsubscribe();
      // Do not abort a deliberate cache warm-up just because the learner
      // briefly returns to the library. The shared run stays alive in this
      // tab, so reopening the same set adopts its current progress instead
      // of restarting at 0 and downloading the remaining audio again.
      setPrewarm(null);
      setPrewarmSummary(null);
      if (summaryTimer !== undefined) window.clearTimeout(summaryTimer);
    };
    // Keyed on stable identity fields so mastery taps (a new `set` object)
    // don't refetch — the words themselves are read through the ref above.
  }, [
    set?.id,
    set?.words.length,
    set?.lang,
    set?.nativeLang,
    canCloudAudio,
    authenticatedCloudEnabled,
    effective.cachedAudio,
    effective.targetVoiceURI,
    effective.translationVoiceURI,
    effective.cloudTts,
    cloudTtsReady,
    targetNeedsCloud,
    translationNeedsCloud,
    t,
  ]);

  useEffect(() => {
    const activeSetId = set?.id;
    const timer = window.setTimeout(() => {
      const saved = activeSetId ? readPlaybackPosition(user?.id, activeSetId) : null;
      lastSavedPositionRef.current = saved && activeSetId
        ? `${activeSetId}:${saved.wordId}`
        : null;
      setResumeWordId(saved?.wordId ?? null);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [set?.id, user?.id]);

  const recordPlaybackPosition = useCallback((word: LoopWord) => {
    if (!set) return;
    const identity = `${set.id}:${word.id}`;
    if (lastSavedPositionRef.current === identity) return;
    lastSavedPositionRef.current = identity;
    savePlaybackPosition(user?.id, set.id, word.id);
    setResumeWordId(null);
  }, [set, user?.id]);

  const {
    progress,
    currentWord,
    isPlaying,
    play,
    pause,
    stop,
    skipNext,
    skipPrevious,
    seekToWord,
    playFromWord,
    playbackError,
    playbackErrorDetail,
  } =
    useAudioLoop({
      words,
      settings: effective,
      engine,
      volume: fadeVolume,
      onWordChange: recordPlaybackPosition,
      album: set?.name,
      artist: set ? (findLanguage(set.lang)?.label ?? set.lang) : undefined,
      // Lock-screen / hardware Play must honor the snooze window too — forward
      // to the snooze-aware start (defined below) through a stable ref.
      onPlayRequest: () => startPlaybackRef.current(),
    });

  const resumeIndex = resumeWordId ? words.findIndex((word) => word.id === resumeWordId) : -1;
  const resumeWord = resumeIndex > 0 ? words[resumeIndex] : null;
  const selectWord = useCallback((wordIndex: number) => {
    setResumeWordId(null);
    seekToWord(wordIndex);
  }, [seekToWord]);
  const resumePlayback = useCallback(() => {
    if (resumeIndex <= 0) return;
    if (cloudVoiceConsentNeeded) {
      setToast(t('player.toast.enableCloudVoice'));
      return;
    }
    setResumeWordId(null);
    playFromWord(resumeIndex);
  }, [cloudVoiceConsentNeeded, playFromWord, resumeIndex, t]);
  const startFromBeginning = useCallback(() => {
    if (set) clearPlaybackPosition(user?.id, set.id);
    lastSavedPositionRef.current = null;
    setResumeWordId(null);
    seekToWord(0);
  }, [seekToWord, set, user?.id]);

  // ---------- daily practice stats (streak, words, study time) ----------
  const { streak, wordsToday, recordWords, recordMs } = usePracticeStats();
  // Free entitlement: stop practice once the daily word allowance is used up.
  // Pro/Lifetime are never limited; the counter resets at local midnight.
  const dailyLimitReached = freeDailyLimitReached(effective.plan, wordsToday);
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
  // Free plan: once the daily allowance is exhausted, halt the loop — the
  // banner below offers the upgrade path and practice resumes at midnight.
  useEffect(() => {
    if (!isPlaying) return;
    if (dailyLimitReached) {
      pause();
      return;
    }
    // play() always starts fresh at word 0 — reset so the first word of a new
    // session is counted even if it was the last word of the previous one.
    if (progress.wordIndex === 0) lastCountedWordRef.current = null;
    if (lastCountedWordRef.current !== progress.wordIndex) {
      lastCountedWordRef.current = progress.wordIndex;
      recordWords(1, set?.lang);
    }
  }, [isPlaying, progress.wordIndex, recordWords, set, dailyLimitReached, pause]);

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
  // with quiz mode, driven by the shared TTS engine. Dictation stays on the
  // Free plan, so its words count against the daily allowance — when the cap
  // is hit, `dictationOn` derives false and the limit banner takes over.
  const [dictationWanted, setDictationWanted] = useState(false);
  const dictationOn = dictationWanted && !dailyLimitReached;
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
  // Forced exit at the cap must also silence any in-flight dictation speech.
  useEffect(() => {
    if (dictationWanted && dailyLimitReached) dictation.stop();
  }, [dictation, dictationWanted, dailyLimitReached]);

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
        setToast(t('player.toast.sleepEnded'));
        return;
      }
      setSleepRemaining(left);
    }, 500);
    return () => window.clearInterval(id);
  }, [sleepEndAt, stop, t]);

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
    if (dailyLimitReached) {
      setToast(t('player.toast.freeLimit', { limit: FREE_DAILY_WORD_LIMIT }));
      return;
    }
    if (cloudVoiceConsentNeeded) {
      setToast(t('player.toast.enableCloudVoice'));
      return;
    }
    play();
    snoozeRestart();
  }, [dailyLimitReached, cloudVoiceConsentNeeded, play, snoozeRestart, t]);

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

  // Dictation start that honors the snooze window (and the Free daily cap —
  // dictation is a Free feature, so its words count against the allowance).
  const startDictation = useCallback(() => {
    if (dailyLimitReached) {
      setToast(t('player.toast.freeLimit', { limit: FREE_DAILY_WORD_LIMIT }));
      return;
    }
    dictation.start();
    snoozeRestart();
  }, [dailyLimitReached, dictation, snoozeRestart, t]);

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
    if (!canQuiz) return; // entitlement guard — the button routes Free to checkout
    if (quizOn) {
      setQuizOn(false);
      quiz.stop();
    } else {
      if (cloudVoiceConsentNeeded) {
        setToast(t('player.toast.enableCloudForQuiz'));
        return;
      }
      setQuizOn(true);
      if (dictationOn) {
        setDictationWanted(false);
        dictation.stop();
      }
      stop(); // halt the loop so both engines never speak at once
      startQuiz();
    }
  }, [canQuiz, quizOn, dictationOn, cloudVoiceConsentNeeded, stop, quiz, dictation, startQuiz, t]);

  const toggleDictation = useCallback(() => {
    if (dictationOn) {
      setDictationWanted(false);
      dictation.stop();
    } else {
      if (cloudVoiceConsentNeeded) {
        setToast(t('player.toast.enableCloudForDictation'));
        return;
      }
      setDictationWanted(true);
      if (quizOn) {
        setQuizOn(false);
        quiz.stop();
      }
      stop(); // halt the loop so only dictation speaks
      startDictation();
    }
  }, [dictationOn, quizOn, cloudVoiceConsentNeeded, stop, dictation, quiz, startDictation, t]);

  const goPrevious = useCallback(() => {
    if (dictationOn) dictation.replay(); else if (quizOn) quiz.replay(); else skipPrevious();
  }, [dictation, dictationOn, quiz, quizOn, skipPrevious]);
  const goNext = useCallback(() => {
    if (dictationOn) dictation.skip(); else if (quizOn) quiz.skip(); else skipNext();
  }, [dictation, dictationOn, quiz, quizOn, skipNext]);
  const onWordPointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    swipeStartRef.current = { x: event.clientX, y: event.clientY, interactive: Boolean(target.closest('button, a, input, select, textarea, label')) };
  }, []);
  const onWordPointerUp = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const start = swipeStartRef.current;
    swipeStartRef.current = null;
    if (!start || start.interactive) return;
    const horizontal = event.clientX - start.x;
    const vertical = event.clientY - start.y;
    if (Math.abs(horizontal) < 72 || Math.abs(horizontal) < Math.abs(vertical) * 1.5) return;
    if (horizontal > 0) goPrevious(); else goNext();
  }, [goNext, goPrevious]);

  // Count each quiz/dictation question as a word listened (keeps streak/stats honest).
  useEffect(() => {
    if (quizOn && quiz.question) recordWords(1, set?.lang);
  }, [quizOn, quiz.question, recordWords, set]);
  // Dictation words count toward the Free daily allowance; `dictationOn`
  // derives false once the cap is hit, so recording stops with practice.
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
          w.id === currentWord.id ? applyMasteryStatus(w, status) : w,
        ),
      });
    },
    [set, currentWord, saveSet],
  );

  const untranslatedMongolianCount = useMemo(() => {
    if (!set || settings.translationLanguage !== 'mongolian' || set.nativeLang.toLowerCase().startsWith('mn')) return 0;
    return set.words.filter((word) => !word.translationMn?.trim()).length;
  }, [set, settings.translationLanguage]);

  const cacheMongolianTranslations = useCallback(async () => {
    if (!set || untranslatedMongolianCount === 0) return;
    if (!user) {
      setToast(t('player.translate.signIn'));
      return;
    }
    const pending = set.words.filter((word) => !word.translationMn?.trim());
    let next = set;
    let done = 0;
    setTranslationProgress({ done, total: pending.length });
    try {
      for (let start = 0; start < pending.length; start += 25) {
        const batch = pending.slice(start, start + 25);
        const translations = await translateBatchToMongolian(
          batch.map((word) => ({ id: word.id, text: word.target })),
        );
        next = {
          ...next,
          words: next.words.map((word) => {
            const translationMn = translations.get(word.id);
            return translationMn ? { ...word, translationMn } : word;
          }),
        };
        await saveSet(next);
        done += batch.length;
        setTranslationProgress({ done, total: pending.length });
      }
      setToast(t('player.translate.complete', { count: pending.length }));
    } catch {
      setToast(t('player.translate.failed'));
    } finally {
      setTranslationProgress(null);
    }
  }, [set, saveSet, t, untranslatedMongolianCount, user]);

  // Surface silent / wrong-language words: true when the current target language
  // has no installed voice at all (the engine falls back to the browser default).
  const cloudVoiceForTarget =
    !!currentWord && !voicesLoading && !hasVoice(currentWord.lang) &&
    cloudAudioActive && (canCloudAudio || isMongolianLocale(currentWord.lang));
  const noVoiceForTarget =
    !!currentWord && !voicesLoading && !hasVoice(currentWord.lang) &&
    !cloudVoiceForTarget;

  // keyboard shortcuts: Space play/pause · ← previous · → next · S stop
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
          skipPrevious();
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
  }, [isPlaying, startPlayback, pause, startQuiz, stopPlayback, skipNext, skipPrevious, quizOn, quiz, dictationOn, dictation]);

  if (loading) {
    return (
      <main id="main-content" className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-4 px-5">
        <div role="status" aria-live="polite" className="flex items-center gap-3 text-sm text-slate-500">
          <span aria-hidden className="h-10 w-10 animate-spin rounded-full border-2 border-neon-cyan/30 border-t-neon-cyan" />
          <span>{t('player.state.loading')}</span>
        </div>
      </main>
    );
  }

  if (!set) {
    return (
      <main id="main-content" className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-4 px-5 text-center">
        <p className="text-2xl font-semibold text-white">{t('player.state.setNotFound')}</p>
        <p className="text-sm text-slate-400">{t('player.state.setNotFoundBody')}</p>
        <Link
          href={LIBRARY_HREF}
          scroll={false}
          onClick={returnToLibrary}
          className="mt-2 rounded-xl bg-gradient-to-r from-neon-cyan to-neon-violet px-5 py-2.5 text-sm font-semibold text-night-950 transition hover:brightness-110"
        >
          {t('player.state.backToLibrary')}
        </Link>
      </main>
    );
  }

  const currentRepeats = currentWord?.repeats ?? effective.repeats;

  return (
    <main id="main-content" className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 pb-28 pt-5 sm:px-5 sm:pb-52 sm:pt-6">
      {toast && (
        <div className="animate-fade-up mb-4 rounded-xl border border-neon-amber/40 bg-neon-amber/10 px-4 py-3 text-sm text-neon-amber">
          {toast}
        </div>
      )}
      <header className={`animate-fade-up relative z-50 flex items-center gap-2 ${focusMode ? 'max-md:hidden' : ''}`}>
        <Link
          href={LIBRARY_HREF}
          scroll={false}
          onClick={returnToLibrary}
          className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm text-slate-400 transition hover:bg-white/5 hover:text-white"
          aria-label={t('player.header.libraryAria')}
        >
          <span>←</span>
          <span>{t('player.header.library')}</span>
        </Link>
        {/* Breadcrumb separator + count pill are desktop-only density — on
            phones they starve the set title of space. */}
        <span className="hidden text-slate-700 sm:inline">/</span>
        <h1 className="min-w-0 truncate text-sm font-semibold text-slate-200">{set.name}</h1>
        <span className="ml-auto hidden shrink-0 rounded-full border border-white/10 px-2.5 py-0.5 text-[11px] text-slate-400 sm:inline">
          {filter === 'all'
            ? t('player.header.wordsAll', { count: set.words.length })
            : t('player.header.wordsFiltered', { shown: words.length, total: set.words.length })}
        </span>
        <StreakBadge streak={streak} />
        <SettingsButton />
        <ProfileDropdown
          onLeaderboard={() => router.push('/')}
          onSubtitles={() => router.push('/')}
          onBrowse={() => router.push('/')}
        />
      </header>

      <div className={`animate-fade-up mt-4 flex flex-wrap items-center gap-1.5 ${focusMode ? 'max-md:hidden' : ''}`}>
        {(
          [
            { key: 'all', label: t('player.filter.all'), count: set.words.length },
            ...(canReview
              ? ([
                  { key: 'learning', label: t('player.filter.learning'), count: learningCount },
                  { key: 'hard', label: t('player.filter.review'), count: hardCount },
                ] as const)
              : []),
          ] as const
        ).map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`inline-flex min-h-10 items-center rounded-full border px-3 py-1.5 text-xs font-medium transition active:scale-95 ${
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
            {filter === 'hard'
              ? t('player.filter.hintHard')
              : t('player.filter.hintLearning')}
          </span>
        )}
        {!canReview && (
          <button
            onClick={upgradeToPro}
            title={t('player.filter.reviewProTitle')}
            className="inline-flex min-h-10 items-center rounded-full border border-neon-amber/30 bg-neon-amber/5 px-3 py-1.5 text-xs font-medium text-neon-amber/90 transition hover:border-neon-amber/60 hover:text-neon-amber active:scale-95"
          >
            <span aria-hidden>⭐</span> {t('player.filter.reviewProLabel')}
          </button>
        )}
        {!canUseAllLangs && (
          <button
            onClick={upgradeToPro}
            title={t('player.filter.freeLangTitle', { limit: FREE_LANG_LIMIT })}
            className="inline-flex min-h-10 items-center rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-400 transition hover:border-neon-amber/40 hover:text-neon-amber active:scale-95"
          >
            <span aria-hidden>⭐</span> {t('player.filter.freeLangLabel', { limit: FREE_LANG_LIMIT })}
          </button>
        )}

        <span className="mx-1 hidden h-5 w-px bg-white/10 sm:block" />

        <button
          onClick={canQuiz ? toggleQuiz : upgradeToPro}
          disabled={words.length === 0}
          aria-pressed={canQuiz ? quizOn : false}
          title={
            words.length === 0
              ? t('player.filter.quizEmpty')
              : canQuiz
                ? t('player.filter.quizHow')
                : t('player.filter.quizProTitle')
          }
          className={`inline-flex min-h-10 items-center rounded-full border px-3 py-1.5 text-xs font-medium transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 ${
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
          {t('player.filter.quiz')}
          {!canQuiz && (
            <span className="ml-1.5 rounded-full bg-neon-amber/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-neon-amber">
              Pro
            </span>
          )}
        </button>

        <button
          onClick={toggleDictation}
          disabled={words.length === 0}
          aria-pressed={dictationOn}
          title={
            words.length === 0
              ? t('player.filter.dictationEmpty')
              : t('player.filter.dictationHow')
          }
          className={`inline-flex min-h-10 items-center rounded-full border px-3 py-1.5 text-xs font-medium transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 ${
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
          {t('player.filter.dictation')}
        </button>

        {sleepEndAt !== null && sleepRemaining !== null && (
          <button
            onClick={() => setSleepTimer(null)}
            title={t('player.filter.sleepCancelTitle')}
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
            title={t('player.filter.snoozeTitle')}
            className="rounded-full border border-neon-amber/40 bg-neon-amber/10 px-3 py-1.5 text-xs font-medium text-neon-amber transition hover:border-neon-amber/70 hover:bg-neon-amber/20 active:scale-95"
          >
            {t('player.filter.snoozeLabel', { time: formatCountdown(snoozeRemaining) })}
          </button>
        )}
        <button type="button" onClick={() => setFocusMode(true)} className="inline-flex min-h-10 items-center rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-400 md:hidden">
          {t('player.focus.enter')}
        </button>
      </div>

      {focusMode && <button type="button" onClick={() => setFocusMode(false)} aria-label={t('player.focus.exitAria')} className="fixed right-4 top-[calc(0.75rem+env(safe-area-inset-top))] z-50 flex h-11 items-center rounded-full border border-white/10 bg-night-900/90 px-3 text-xs font-semibold text-slate-200 shadow-lg backdrop-blur md:hidden">{t('player.focus.exit')}</button>}

      <div className="flex flex-1 flex-col justify-center py-8">
        {words.length === 0 ? (
          <div className="animate-fade-up flex flex-col items-center gap-3 text-center">
            <p className="text-3xl font-bold text-white">{t('player.empty.title')}</p>
            <p className="max-w-xs text-sm text-slate-400">
              {filter === 'hard'
                ? t('player.empty.hardBody')
                : t('player.empty.masteredBody')}
            </p>
            <button
              onClick={() => setFilter('all')}
              className="mt-2 rounded-xl bg-gradient-to-r from-neon-cyan to-neon-violet px-5 py-2.5 text-sm font-semibold text-night-950 transition hover:brightness-110 active:scale-95"
            >
              {t('player.empty.playAll', { count: set.words.length })}
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
            {dailyLimitReached && (
              <section
                aria-labelledby="daily-limit-title"
                className="mx-auto mb-7 w-full max-w-md rounded-2xl border border-neon-amber/30 bg-neon-amber/[0.07] p-4 text-left shadow-[0_14px_40px_rgba(0,0,0,0.18)] sm:p-5"
              >
                <div className="flex items-start gap-3.5">
                  <span
                    aria-hidden="true"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-neon-amber/15 text-lg text-neon-amber"
                  >
                    ⭐
                  </span>
                  <div className="min-w-0 flex-1">
                    <h2 id="daily-limit-title" className="text-sm font-bold text-white">
                      {t('player.limit.title')}
                    </h2>
                    <p className="mt-1 text-xs leading-relaxed text-slate-400">
                      {t('player.limit.body', { limit: FREE_DAILY_WORD_LIMIT })}
                    </p>
                    <button
                      type="button"
                      onClick={upgradeToPro}
                      className="mt-3 min-h-11 w-full rounded-xl bg-neon-amber px-4 text-sm font-bold text-night-950 transition hover:brightness-110 active:scale-[0.98] sm:w-auto"
                    >
                      {t('player.limit.upgrade')}
                    </button>
                  </div>
                </div>
              </section>
            )}
            {resumeWord && !isPlaying && progress.wordIndex === 0 && (
              <div className="mx-auto mb-7 flex w-full max-w-md flex-col gap-4 rounded-2xl border border-neon-cyan/20 bg-neon-cyan/5 p-4 text-left sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neon-cyan">{t('player.resume.heading')}</p>
                  <p className="mt-1 truncate text-sm font-semibold text-white">
                    {t('player.resume.wordLine', { index: resumeIndex + 1, word: resumeWord.target })}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-slate-500">{resumeWord.translation}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={startFromBeginning}
                    className="min-h-11 rounded-xl border border-white/10 px-3 text-xs font-semibold text-slate-400 transition hover:border-white/20 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan"
                  >
                    {t('player.resume.startOver')}
                  </button>
                  <button
                    type="button"
                    onClick={resumePlayback}
                    className="min-h-11 rounded-xl bg-neon-cyan px-4 text-xs font-bold text-night-950 transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-night-950"
                  >
                    {t('player.resume.cta')}
                  </button>
                </div>
              </div>
            )}
            {cloudVoiceConsentNeeded && (
              <section
                aria-labelledby="cloud-voice-title"
                className="mx-auto mb-7 w-full max-w-md rounded-2xl border border-neon-cyan/25 bg-neon-cyan/[0.07] p-4 text-left shadow-[0_14px_40px_rgba(0,0,0,0.18)] sm:p-5"
              >
                <div className="flex items-start gap-3.5">
                  <span
                    aria-hidden="true"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-neon-cyan/15 text-lg text-neon-cyan"
                  >
                    ☁
                  </span>
                  <div className="min-w-0 flex-1">
                    <h2 id="cloud-voice-title" className="text-sm font-bold text-white">
                      {t('player.cloudVoice.title')}
                    </h2>
                    <p className="mt-1 text-xs leading-relaxed text-slate-400">
                      {t('player.cloudVoice.body')}
                    </p>
                    <button
                      type="button"
                      onClick={requestCloudVoice}
                      className="mt-3 min-h-11 w-full rounded-xl bg-neon-cyan px-4 text-sm font-bold text-night-950 transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-night-950 active:scale-[0.98] sm:w-auto"
                    >
                      {user ? t('player.cloudVoice.enable') : t('player.cloudVoice.signInEnable')}
                    </button>
                    <p className="mt-2 text-[11px] text-slate-500">
                      {t('player.cloudVoice.footer')}
                    </p>
                  </div>
                </div>
              </section>
            )}
            {mongolianCloudSignInRequired && (
              <section
                aria-labelledby="mongolian-cloud-sign-in-title"
                className="mx-auto mb-7 w-full max-w-md rounded-2xl border border-neon-violet/30 bg-neon-violet/[0.07] p-4 text-left shadow-[0_14px_40px_rgba(0,0,0,0.18)] sm:p-5"
              >
                <div className="flex items-start gap-3.5">
                  <span
                    aria-hidden="true"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-neon-violet/15 text-lg text-neon-violet"
                  >
                    ☁
                  </span>
                  <div className="min-w-0 flex-1">
                    <h2 id="mongolian-cloud-sign-in-title" className="text-sm font-bold text-white">
                      {t('player.mongolianVoice.signInTitle')}
                    </h2>
                    <p className="mt-1 text-xs leading-relaxed text-slate-400">
                      {t('player.mongolianVoice.signInBody')}
                    </p>
                    <button
                      type="button"
                      onClick={() => setCloudAuthOpen(true)}
                      className="mt-3 min-h-11 w-full rounded-xl bg-neon-violet px-4 text-sm font-bold text-white transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-violet focus-visible:ring-offset-2 focus-visible:ring-offset-night-950 active:scale-[0.98] sm:w-auto"
                    >
                      {t('player.mongolianVoice.signInAction')}
                    </button>
                  </div>
                </div>
              </section>
            )}
            {settings.translationLanguage === 'mongolian' && untranslatedMongolianCount > 0 && (
              <section
                aria-labelledby="mongolian-translation-title"
                className="mx-auto mb-7 w-full max-w-md rounded-2xl border border-neon-violet/30 bg-neon-violet/[0.07] p-4 text-left shadow-[0_14px_40px_rgba(0,0,0,0.18)] sm:p-5"
              >
                <div className="flex items-start gap-3.5">
                  <span
                    aria-hidden="true"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-neon-violet/15 text-lg text-neon-violet"
                  >
                    文
                  </span>
                  <div className="min-w-0 flex-1">
                    <h2 id="mongolian-translation-title" className="text-sm font-bold text-white">
                      {t('player.translate.title')}
                    </h2>
                    <p className="mt-1 text-xs leading-relaxed text-slate-400">
                      {t('player.translate.body', { count: untranslatedMongolianCount })}
                    </p>
                    {translationProgress ? (
                      <p className="mt-3 text-xs font-semibold text-neon-violet" aria-live="polite">
                        {t('player.translate.progress', translationProgress)}
                      </p>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void cacheMongolianTranslations()}
                        className="mt-3 min-h-11 w-full rounded-xl bg-neon-violet px-4 text-sm font-bold text-white transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-violet focus-visible:ring-offset-2 focus-visible:ring-offset-night-950 active:scale-[0.98] sm:w-auto"
                      >
                        {t('player.translate.start')}
                      </button>
                    )}
                  </div>
                </div>
              </section>
            )}
            <div onPointerDown={onWordPointerDown} onPointerUp={onWordPointerUp} className="touch-pan-y">
            <WordCard
              word={currentWord}
              wordIndex={progress.wordIndex}
              repeatIndex={progress.repeatIndex}
              isTranslation={progress.isTranslation}
              repeats={currentRepeats}
              total={words.length}
              showHints={effective.showHints}
              showExamples={effective.showExamples}
              noVoice={noVoiceForTarget && !cloudVoiceConsentNeeded}
              cloudVoice={cloudVoiceForTarget}
              cloudCacheState={freeMongolianVoice ? mongolianCloudCacheState : null}
              canMark={canReview}
              allowTranslationReport={settings.translationLanguage === 'mongolian'}
              onMark={markWord}
            />
            {/* TTS kept failing: playback is paused and the user must know. */}
            {playbackError && (
              <div
                role="alert"
                className="mx-auto mb-4 max-w-md rounded-xl border border-neon-amber/40 bg-neon-amber/10 px-4 py-3 text-center text-sm text-neon-amber"
              >
                <p className="font-semibold">{t('player.playback.error.title')}</p>
                <p className="mt-1 text-xs leading-relaxed opacity-90">
                  {playbackErrorDetail === 'cloud-mongolian-voice-unavailable'
                    ? t('player.playback.error.cloudMongolian')
                    : t('player.playback.error.body')}
                </p>
                <button
                  type="button"
                  onClick={() => play()}
                  className="mt-2 min-h-11 rounded-lg border border-neon-amber/50 px-4 py-2 text-xs font-semibold transition hover:bg-neon-amber/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan"
                >
                  {t('player.playback.error.retry')}
                </button>
              </div>
            )}
            {/* Screen-reader track announcement (visual card above). */}
            <p aria-live="polite" className="sr-only">
              {currentWord &&
                t('player.card.liveAnnounce', {
                  index: progress.wordIndex + 1,
                  total: words.length,
                  word: currentWord.target,
                  translation: currentWord.translation,
                })}
            </p>
            <ProgressBar
              wordIndex={progress.wordIndex}
              repeatIndex={progress.repeatIndex}
              isTranslation={progress.isTranslation}
              repeats={currentRepeats}
              total={words.length}
              onSeek={selectWord}
              onOpenNavigator={() => setNavigatorOpen(true)}
            />
            </div>
          </>
        )}
      </div>

      {!focusMode && <SettingsPanel
        settings={effective}
        onChange={changeSettings}
        customMode={customMode}
        onToggleCustom={toggleCustom}
        pro={canReview}
        sleepMinutes={sleepMinutes}
        sleepRemaining={sleepRemaining}
        onSleepChange={setSleepTimer}
        voices={voices}
        voicesLoading={voicesLoading}
        targetLang={set.lang}
        nativeLang={set.nativeLang}
        prewarm={prewarm}
        prewarmSummary={prewarmSummary}
        cloudTtsReady={cloudTtsReady}
      />}

      <WordNavigator
        open={navigatorOpen}
        words={words}
        currentIndex={progress.wordIndex}
        onSelect={selectWord}
        onClose={() => setNavigatorOpen(false)}
      />

      {cloudAuthOpen && (
        <AuthScreen
          mode="overlay"
          onSuccess={enableCloudVoice}
          onClose={() => setCloudAuthOpen(false)}
        />
      )}

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
        onSkipNext={goNext}
        onBack={goPrevious}
        backAction={dictationOn || quizOn ? 'replay' : 'previous'}
        speed={effective.speed}
        onSpeedChange={(speed) => changeSettings({ speed })}
        shuffle={shuffle}
        onShuffleToggle={toggleShuffle}
      />
    </main>
  );
}
