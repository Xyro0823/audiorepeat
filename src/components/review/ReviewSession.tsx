'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AuthScreen from '@/components/auth/AuthScreen';
import ProFeatureLock from '@/components/common/ProFeatureLock';
import { useAuth } from '@/hooks/useAuth';
import { useCloudTtsStatus } from '@/hooks/useCloudTtsStatus';
import { useLists } from '@/hooks/useLists';
import { usePracticeStats } from '@/hooks/usePracticeStats';
import { useSpeechVoices } from '@/hooks/useSpeechVoices';
import { useT } from '@/lib/i18n';
import { planHasFeature } from '@/lib/plans';
import { CachedAudioEngine } from '@/lib/tts/cachedAudioEngine';
import { CloudTtsEngine } from '@/lib/tts/cloudTtsEngine';
import { SpeechSynthesisEngine } from '@/lib/tts/speechSynthesisEngine';
import {
  applyReviewRating,
  buildDueReviewQueue,
  estimatedReviewMinutes,
  type DueReviewItem,
  type ReviewRating,
} from '@/lib/review/fsrs';

const SESSION_LIMIT = 30;

export default function ReviewSession() {
  const t = useT();
  const { sets, loading, settings, saveSettings, saveSet } = useLists();
  const { user } = useAuth();
  const { recordWords } = usePracticeStats();
  const { loading: voicesLoading, hasVoice } = useSpeechVoices();
  const cloudReady = useCloudTtsStatus();
  // FSRS review is a Pro entitlement — direct URL navigation lands on the
  // lock screen instead of the feature (entry buttons gate the same way).
  const canReview = planHasFeature(settings.plan, 'fsrsReview');
  const canCloudAudio = planHasFeature(settings.plan, 'offlineAudio');
  const [queue, setQueue] = useState<DueReviewItem[] | null>(null);
  const [initialTotal, setInitialTotal] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [completed, setCompleted] = useState(0);
  const [cloudAuthOpen, setCloudAuthOpen] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (loading || !canReview || startedRef.current) return;
    startedRef.current = true;
    const session = buildDueReviewQueue(sets, new Date(), SESSION_LIMIT);
    setQueue(session);
    setInitialTotal(session.length);
  }, [loading, canReview, sets]);

  const deviceEngine = useMemo(() => new SpeechSynthesisEngine(), []);
  const cloudEngine = useMemo(
    () => new CachedAudioEngine(new CloudTtsEngine(deviceEngine)),
    [deviceEngine],
  );
  useEffect(() => () => {
    deviceEngine.stop();
    cloudEngine.stop();
  }, [cloudEngine, deviceEngine]);

  const current = queue?.[0] ?? null;
  const currentNeedsCloud = Boolean(
    current &&
    canCloudAudio &&
    !voicesLoading &&
    (!hasVoice(current.lang) || !hasVoice(current.nativeLang)) &&
    cloudReady,
  );
  const cloudConsentNeeded = currentNeedsCloud && !settings.cloudTts;

  const speak = useCallback(
    (text: string, lang: string, voiceURI?: string) => {
      const useCloud = canCloudAudio && settings.cloudTts && cloudReady && !hasVoice(lang);
      const engine = useCloud ? cloudEngine : deviceEngine;
      setSpeaking(true);
      engine.speak({
        text,
        lang,
        rate: settings.speed,
        voiceURI: useCloud ? undefined : voiceURI,
        onEnd: () => setSpeaking(false),
        onError: () => setSpeaking(false),
      });
    },
    [canCloudAudio, cloudEngine, cloudReady, deviceEngine, hasVoice, settings.cloudTts, settings.speed],
  );

  const speakTarget = useCallback(() => {
    if (!current || cloudConsentNeeded) return;
    speak(current.word.target, current.lang, settings.targetVoiceURI);
  }, [cloudConsentNeeded, current, settings.targetVoiceURI, speak]);

  const revealAnswer = useCallback(() => {
    if (!current) return;
    setRevealed(true);
    speak(current.word.translation, current.nativeLang, settings.translationVoiceURI);
  }, [current, settings.translationVoiceURI, speak]);

  const rate = useCallback(async (rating: ReviewRating) => {
    if (!current || saving) return;
    setSaving(true);
    setSessionError(null);
    try {
      const source = sets.find((set) => set.id === current.setId);
      if (!source) throw new Error('source-set-missing');
      const reviewed = applyReviewRating(current.word, rating);
      await saveSet({
        ...source,
        words: source.words.map((word) => (word.id === current.word.id ? reviewed : word)),
      });
      recordWords(1, current.lang);
      deviceEngine.stop();
      cloudEngine.stop();
      setSpeaking(false);
      setRevealed(false);
      setCompleted((count) => count + 1);
      setQueue((items) => items?.slice(1) ?? []);
    } catch {
      setSessionError(t('review.error.saveFailed'));
    } finally {
      setSaving(false);
    }
  }, [cloudEngine, current, deviceEngine, recordWords, saveSet, saving, sets, t]);

  const enableCloudVoice = useCallback(() => {
    saveSettings({ cloudTts: true });
  }, [saveSettings]);

  // Free plan: FSRS review is Pro — render the lock instead of the feature
  // (after the loading window so a Pro user's hydrating settings never flash
  // the lock on direct navigation).
  if (!canReview && !loading) {
    return (
      <ProFeatureLock
        title={t('review.lock.title')}
        description={t('review.lock.body')}
      />
    );
  }

  if (loading || queue === null) {
    return (
      <main className="mx-auto flex min-h-[70vh] w-full max-w-3xl items-center justify-center px-5">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-neon-violet/30 border-t-neon-violet" />
      </main>
    );
  }

  if (!current) {
    return (
      <main className="mx-auto flex min-h-[75vh] w-full max-w-xl flex-col items-center justify-center px-5 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full border border-neon-green/25 bg-neon-green/10 text-4xl">✓</div>
        <p className="mt-6 text-xs font-semibold uppercase tracking-[0.24em] text-neon-green">
          {completed > 0 ? t('review.done.eyebrow') : t('review.empty.eyebrow')}
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">
          {completed > 0
            ? t('review.done.title', { count: completed })
            : t('review.empty.title')}
        </h1>
        <p className="mt-3 max-w-sm text-sm leading-relaxed text-slate-400">
          {completed > 0
            ? t('review.done.body')
            : t('review.empty.body')}
        </p>
        <Link
          href="/dashboard#review-today"
          className="mt-7 inline-flex min-h-11 items-center justify-center rounded-xl bg-neon-violet px-5 text-sm font-bold text-white transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-violet"
        >
          {t('review.backToDashboard')}
        </Link>
      </main>
    );
  }

  const progress = initialTotal > 0 ? Math.round((completed / initialTotal) * 100) : 0;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-5 pb-12 pt-6">
      <header className="flex items-center gap-3">
        <Link
          href="/dashboard#review-today"
          className="rounded-lg px-2 py-2 text-sm text-slate-400 transition hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-violet"
        >
          {t('review.dashboardCrumb')}
        </Link>
        <span className="text-slate-700">/</span>
        <h1 className="text-sm font-semibold text-white">{t('review.header.title')}</h1>
        <span className="ml-auto text-xs tabular-nums text-slate-500">
          {completed + 1} / {initialTotal}
        </span>
      </header>

      <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
        <div
          className="h-full rounded-full bg-neon-violet transition-[width] duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      <section className="flex flex-1 flex-col items-center justify-center py-10 text-center">
        <div className="mb-7 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          <span className="rounded-full border border-white/10 px-2.5 py-1 text-slate-400">
            {current.setName}
          </span>
          <span>{t('review.timeLeft', { minutes: estimatedReviewMinutes(queue.length) })}</span>
        </div>

        <p className="text-5xl font-bold tracking-tight text-neon-cyan sm:text-6xl">
          {current.word.target}
        </p>

        <button
          type="button"
          onClick={speakTarget}
          disabled={speaking || cloudConsentNeeded}
          className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-full border border-neon-cyan/30 bg-neon-cyan/10 px-4 text-sm font-semibold text-neon-cyan transition hover:bg-neon-cyan/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span aria-hidden>{speaking ? '◼' : '▶'}</span>
          {speaking ? t('review.speaking') : t('review.hearWord')}
        </button>

        {cloudConsentNeeded ? (
          <div className="mt-7 w-full max-w-md rounded-2xl border border-neon-cyan/25 bg-neon-cyan/[0.07] p-4 text-left">
            <p className="text-sm font-bold text-white">{t('review.cloud.title')}</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-400">
              {t('review.cloud.body')}
            </p>
            <button
              type="button"
              onClick={() => {
                if (user) enableCloudVoice();
                else setCloudAuthOpen(true);
              }}
              className="mt-3 min-h-11 w-full rounded-xl bg-neon-cyan px-4 text-sm font-bold text-night-950 transition hover:brightness-110 sm:w-auto"
            >
              {user
                ? t('review.cloud.enable')
                : t('review.cloud.enableSignIn')}
            </button>
          </div>
        ) : !revealed ? (
          <button
            type="button"
            onClick={revealAnswer}
            className="mt-10 min-h-12 rounded-xl bg-white px-6 text-sm font-bold text-night-950 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-night-950 active:scale-[0.98]"
          >
            {t('review.showAnswer')}
          </button>
        ) : (
          <div className="mt-9 w-full max-w-xl animate-fade-up">
            <p className="text-2xl font-semibold text-neon-violet">{current.word.translation}</p>
            <p className="mt-6 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              {t('review.rate.prompt')}
            </p>
            <div className="mt-3 grid grid-cols-3 gap-2 sm:gap-3">
              {([
                { rating: 'again', label: t('review.rate.again'), hint: t('review.rate.againHint'), tone: 'border-neon-magenta/35 text-neon-magenta hover:bg-neon-magenta/10' },
                { rating: 'hard', label: t('review.rate.review'), hint: t('review.rate.soonHint'), tone: 'border-neon-amber/35 text-neon-amber hover:bg-neon-amber/10' },
                { rating: 'good', label: t('review.rate.known'), hint: t('review.rate.laterHint'), tone: 'border-neon-green/35 text-neon-green hover:bg-neon-green/10' },
              ] as const).map((choice) => (
                <button
                  key={choice.rating}
                  type="button"
                  disabled={saving}
                  onClick={() => void rate(choice.rating)}
                  className={`min-h-16 rounded-xl border px-2 py-2 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current disabled:opacity-50 ${choice.tone}`}
                >
                  <span className="block">{choice.label}</span>
                  <span className="mt-0.5 block text-[10px] font-medium opacity-60">{choice.hint}</span>
                </button>
              ))}
            </div>
            {sessionError && (
              <p className="mt-3 text-sm text-neon-magenta" role="alert">{sessionError}</p>
            )}
          </div>
        )}
      </section>

      {cloudAuthOpen && (
        <AuthScreen
          mode="overlay"
          onSuccess={enableCloudVoice}
          onClose={() => setCloudAuthOpen(false)}
        />
      )}
    </main>
  );
}
