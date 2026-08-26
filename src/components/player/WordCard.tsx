'use client';

import Link from 'next/link';
import { emojiForText } from '@/lib/emoji';
import { useT } from '@/lib/i18n';
import type { MasteryStatus } from '@/types/app';
import type { LoopWord } from '@/types/loop';

interface Props {
  word: LoopWord | null;
  wordIndex: number;
  repeatIndex: number;
  isTranslation: boolean;
  repeats: number;
  total: number;
  showHints: boolean;
  showExamples: boolean;
  /** True when no installed TTS voice can cover the target language. */
  noVoice?: boolean;
  /** True when the server cloud voice covers a missing device voice. */
  cloudVoice?: boolean;
  /** Progress of the Free Mongolian Azure voice cache for this translation. */
  cloudCacheState?: 'saving' | 'cached' | null;
  /** False hides the mastery (spaced-repetition) buttons behind a Pro link. */
  canMark?: boolean;
  onMark: (status: MasteryStatus | undefined) => void;
}

export default function WordCard({
  word,
  wordIndex,
  repeatIndex,
  isTranslation,
  repeats,
  total,
  showHints,
  showExamples,
  noVoice = false,
  cloudVoice = false,
  cloudCacheState = null,
  canMark = true,
  onMark,
}: Props) {
  const t = useT();
  const emoji = word && showHints && !isTranslation ? emojiForText(word.translation) : null;

  if (!word) {
    return (
      <div className="animate-fade-up flex flex-col items-center gap-4 py-10 text-center">
        <div className="flex h-16 w-16 animate-pulse-glow items-center justify-center rounded-full bg-gradient-to-br from-neon-cyan to-neon-violet text-night-950">
          <svg viewBox="0 0 24 24" className="h-7 w-7 translate-x-0.5" fill="currentColor">
            <path d="M8 5.5v13a1 1 0 0 0 1.5.87l11-6.5a1 1 0 0 0 0-1.74l-11-6.5A1 1 0 0 0 8 5.5Z" />
          </svg>
        </div>
        <p className="text-lg font-semibold text-white">{t('player.card.readyTitle')}</p>
        <p className="max-w-xs text-sm text-slate-400">
          {t('player.card.readyBody')}
        </p>
      </div>
    );
  }

  return (
    <div
      key={`${word.id}-${isTranslation ? 't' : 'r'}`}
      className="animate-fade-up flex flex-col items-center text-center"
    >
      <p className="mb-6 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.3em] text-slate-500">
        <span>
          {isTranslation
            ? t('player.card.translationPos', { index: wordIndex + 1, total })
            : t('player.card.targetPos', { index: wordIndex + 1, total })}
        </span>
        {word.mastery === 'mastered' && (
          <span className="rounded-full border border-neon-green/40 bg-neon-green/10 px-2 py-0.5 text-[10px] font-semibold normal-case tracking-normal text-neon-green">
            ✓ {t('player.badge.mastered')}
          </span>
        )}
        {word.mastery === 'hard' && (
          <span className="rounded-full border border-neon-amber/40 bg-neon-amber/10 px-2 py-0.5 text-[10px] font-semibold normal-case tracking-normal text-neon-amber">
            ★ {t('player.badge.review')}
          </span>
        )}
      </p>

      {emoji && (
        <span
          role="img"
          aria-label={t('player.hint.emoji')}
          className="mb-4 text-5xl leading-none drop-shadow-[0_0_18px_rgba(34,228,255,0.3)]"
        >
          {emoji}
        </span>
      )}

      <p
        className={`text-5xl font-bold tracking-tight sm:text-6xl ${
          isTranslation ? 'text-neon-violet' : 'text-neon-cyan'
        }`}
      >
        {isTranslation ? word.translation : word.target}
      </p>

      <p className="mt-5 text-2xl text-slate-400">
        {isTranslation ? word.target : word.translation}
      </p>

      {!isTranslation && noVoice && (
        <span
          title={t('player.card.noVoiceTitle')}
          className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-neon-amber/40 bg-neon-amber/10 px-3 py-1 text-[11px] font-semibold text-neon-amber"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-3.5 w-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M11 5 6 9H2v6h4l5 4V5Z" />
            <path d="m23 9-6 6" />
            <path d="m17 9 6 6" />
          </svg>
          {t('player.card.noVoice')}
        </span>
      )}

      {!isTranslation && cloudVoice && (
        <span
          title={t('player.card.cloudVoiceTitle')}
          className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-neon-cyan/30 bg-neon-cyan/10 px-3 py-1 text-[11px] font-semibold text-neon-cyan"
        >
          <span aria-hidden>☁</span> {t('player.card.cloudVoice')}
        </span>
      )}

      {isTranslation && cloudCacheState && (
        <span
          role="status"
          className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-neon-cyan/30 bg-neon-cyan/10 px-3 py-1 text-[11px] font-semibold text-neon-cyan"
        >
          {cloudCacheState === 'saving' && (
            <span className="h-3 w-3 animate-spin rounded-full border border-neon-cyan/30 border-t-neon-cyan" />
          )}
          <span aria-hidden>{cloudCacheState === 'saving' ? '☁' : '✓'}</span>
          {cloudCacheState === 'saving'
            ? t('player.card.cloudCaching')
            : t('player.card.cloudCached')}
        </span>
      )}

      {!isTranslation && showExamples && word.example && (
        <p className="mt-6 max-w-md text-base italic leading-relaxed text-slate-400">
          “{word.example}”
        </p>
      )}

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
            {t('player.card.repeatN', { current: repeatIndex + 1, total: repeats })}
          </span>
        </div>
      )}

      {canMark ? (
        <div className="mt-8 flex items-center gap-3">
          <button
            onClick={() => onMark(word.mastery === 'mastered' ? undefined : 'mastered')}
            aria-pressed={word.mastery === 'mastered'}
            title={word.mastery === 'mastered' ? t('player.mastery.unmark') : t('player.mastery.markKnown')}
            className={`flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-semibold transition active:scale-95 ${
              word.mastery === 'mastered'
                ? 'border-neon-green/60 bg-neon-green/15 text-neon-green shadow-[0_0_14px_rgba(77,255,158,0.25)]'
                : 'border-white/10 bg-white/5 text-slate-400 hover:border-neon-green/50 hover:text-neon-green'
            }`}
          >
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M20 6 9 17l-5-5" />
            </svg>
            {t('player.mastery.known')}
          </button>
          <button
            onClick={() => onMark(word.mastery === 'hard' ? undefined : 'hard')}
            aria-pressed={word.mastery === 'hard'}
            title={word.mastery === 'hard' ? t('player.mastery.unmark') : t('player.mastery.markReview')}
            className={`flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-semibold transition active:scale-95 ${
              word.mastery === 'hard'
                ? 'border-neon-amber/60 bg-neon-amber/15 text-neon-amber shadow-[0_0_14px_rgba(255,201,77,0.25)]'
                : 'border-white/10 bg-white/5 text-slate-400 hover:border-neon-amber/50 hover:text-neon-amber'
            }`}
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
              <path d="M12 2.5 14.9 8.4l6.4.9-4.6 4.5 1.1 6.3L12 17.3 6.2 20.1l1.1-6.3L2.7 9.3l6.4-.9L12 2.5Z" />
          </svg>
            {t('player.mastery.review')}
          </button>
        </div>
      ) : (
        <div className="mt-8">
          <Link
            href="/checkout?plan=pro"
            title={t('player.mastery.proTitle')}
            className="inline-flex items-center gap-1.5 rounded-full border border-neon-amber/30 bg-neon-amber/5 px-4 py-2 text-sm font-semibold text-neon-amber/90 transition hover:border-neon-amber/60 hover:text-neon-amber"
          >
            <span aria-hidden>⭐</span> {t('player.mastery.proCta')}
          </Link>
        </div>
      )}
    </div>
  );
}
