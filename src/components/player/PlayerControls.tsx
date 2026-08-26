'use client';

import { useState } from 'react';
import { useT } from '@/lib/i18n';
import { haptic } from '@/lib/haptics';

const SPEED_OPTIONS = [0.75, 1, 1.25, 1.5];

interface Props {
  isPlaying: boolean;
  onPlayPause: () => void;
  onStop: () => void;
  onSkipNext: () => void;
  onBack: () => void;
  backAction: 'previous' | 'replay';
  speed: number;
  onSpeedChange: (speed: number) => void;
  /** Randomize playback order. */
  shuffle: boolean;
  onShuffleToggle: () => void;
}

export default function PlayerControls({
  isPlaying,
  onPlayPause,
  onStop,
  onSkipNext,
  onBack,
  backAction,
  speed,
  onSpeedChange,
  shuffle,
  onShuffleToggle,
}: Props) {
  const t = useT();
  const [moreOpen, setMoreOpen] = useState(false);
  const cycleSpeed = () => {
    // Snaps non-preset values (e.g. 1.3 from the fine-grained settings slider)
    // to the first preset on the next tap.
    const i = SPEED_OPTIONS.findIndex((s) => Math.abs(s - speed) < 0.001);
    onSpeedChange(SPEED_OPTIONS[(i + 1) % SPEED_OPTIONS.length]);
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/5 bg-night-950/80 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl">
      {/* Phone: large essentials stay visible; secondary actions live in More. */}
      <div className="mx-auto flex w-full max-w-3xl flex-row items-center justify-center gap-1 px-2 py-2 sm:gap-5 sm:px-4 sm:py-5">
        <div className="flex items-center justify-center gap-1 sm:gap-5">
        <button
          onClick={() => { haptic(); onBack(); }}
          aria-label={backAction === 'previous' ? t('player.controls.prevAria') : t('player.controls.replayAria')}
          title={backAction === 'previous' ? t('player.controls.prevTitle') : t('player.controls.replayAria')}
          className="flex h-[52px] w-[52px] items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-200 transition hover:border-neon-cyan/50 hover:text-neon-cyan active:scale-90 sm:h-14 sm:w-14"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-6 w-6"
            fill={backAction === 'previous' ? 'currentColor' : 'none'}
            stroke={backAction === 'replay' ? 'currentColor' : undefined}
            strokeWidth={backAction === 'replay' ? '2' : undefined}
            strokeLinecap={backAction === 'replay' ? 'round' : undefined}
            strokeLinejoin={backAction === 'replay' ? 'round' : undefined}
          >
            {backAction === 'previous' ? (
              <>
                <path d="M19 5.5v13a1 1 0 0 1-1.5.87l-10-6.5a1 1 0 0 1 0-1.74l10-6.5A1 1 0 0 1 19 5.5Z" />
                <rect x="4.8" y="5" width="2.2" height="14" rx="1" />
              </>
            ) : (
              <>
                <path d="M3 12a9 9 0 1 0 3-6.7" />
                <path d="M3 4v5h5" />
              </>
            )}
          </svg>
        </button>

        <button
          onClick={() => { haptic(); onPlayPause(); }}
          aria-label={isPlaying ? t('player.controls.pause') : t('player.controls.play')}
          className={`relative flex h-16 w-16 items-center justify-center rounded-full text-night-950 transition active:scale-90 sm:h-20 sm:w-20 ${
            isPlaying
              ? 'bg-gradient-to-br from-neon-cyan to-neon-violet'
              : 'bg-gradient-to-br from-neon-cyan to-neon-violet animate-pulse-glow'
          }`}
        >
          {isPlaying ? (
            <svg viewBox="0 0 24 24" className="h-7 w-7 sm:h-8 sm:w-8" fill="currentColor">
              <rect x="6" y="5" width="4" height="14" rx="1" />
              <rect x="14" y="5" width="4" height="14" rx="1" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" className="h-7 w-7 translate-x-0.5 sm:h-8 sm:w-8" fill="currentColor">
              <path d="M8 5.5v13a1 1 0 0 0 1.5.87l11-6.5a1 1 0 0 0 0-1.74l-11-6.5A1 1 0 0 0 8 5.5Z" />
            </svg>
          )}
          {isPlaying && (
            <span className="absolute -top-2 right-0 flex h-4 items-end gap-0.5">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="eq-bar w-1 rounded-sm bg-neon-cyan"
                  style={{ height: '100%', animationDelay: `${i * 0.18}s` }}
                />
              ))}
            </span>
          )}
        </button>

        <button
          onClick={() => { haptic(); onSkipNext(); }}
          aria-label={t('player.controls.nextWord')}
          title={t('player.controls.nextWord')}
          className="flex h-[52px] w-[52px] items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-200 transition hover:border-neon-cyan/50 hover:text-neon-cyan active:scale-90 sm:h-14 sm:w-14"
        >
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor">
            <path d="M5 5.5v13a1 1 0 0 0 1.5.87l10-6.5a1 1 0 0 0 0-1.74l-10-6.5A1 1 0 0 0 5 5.5Z" />
            <rect x="17" y="5" width="2.2" height="14" rx="1" />
          </svg>
        </button>
        </div>

        <div className="flex items-center justify-center gap-1 sm:gap-5">
          <button
          onClick={() => { haptic(); onStop(); }}
            aria-label={t('player.controls.stop')}
            title={t('player.controls.stop')}
            className="hidden h-[52px] w-[52px] items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-300 transition hover:border-neon-magenta/50 hover:text-neon-magenta active:scale-90 sm:flex sm:h-14 sm:w-14"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
          </button>

        <button
          onClick={() => { haptic(); cycleSpeed(); }}
          aria-label={t('player.controls.speedAria', { speed })}
          title={t('player.controls.speedTitle')}
          className={`flex h-[52px] w-[52px] shrink-0 flex-col items-center justify-center gap-0.5 rounded-full border transition active:scale-90 sm:h-14 sm:w-auto sm:gap-1 sm:px-4 ${
            speed !== 1
              ? 'border-neon-cyan/60 bg-neon-cyan/10 text-neon-cyan glow-cyan'
              : 'border-white/10 bg-white/5 text-slate-300 hover:border-neon-cyan/50 hover:text-neon-cyan'
          }`}
        >
          <svg
            viewBox="0 0 24 24"
            className="h-3.5 w-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M13 2 4.5 13.5H11L9.5 22 19 9.5h-6.5L13 2Z" />
          </svg>
          <span className="text-xs font-bold leading-none">{speed}×</span>
        </button>

        <button
          onClick={() => { haptic(); onShuffleToggle(); }}
          aria-pressed={shuffle}
          aria-label={shuffle ? t('player.controls.shuffleOn') : t('player.controls.shuffleOff')}
          title={shuffle ? t('player.controls.shuffleOn') : t('player.controls.shuffleOff')}
          className={`hidden h-[52px] w-[52px] items-center justify-center rounded-full border transition active:scale-90 sm:flex sm:h-14 sm:w-14 ${
            shuffle
              ? 'border-neon-violet/60 bg-neon-violet/10 text-neon-violet glow-cyan'
              : 'border-white/10 bg-white/5 text-slate-300 hover:border-neon-violet/50 hover:text-neon-violet'
          }`}
        >
          <svg
            viewBox="0 0 24 24"
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M16 3h5v5" />
            <path d="M4 20 21 3" />
            <path d="M21 16v5h-5" />
            <path d="m15 15 6 6" />
            <path d="M4 4l5 5" />
          </svg>
          </button>

          <div className="relative sm:hidden">
            {moreOpen && (
              <div
                role="menu"
                className="absolute bottom-[calc(100%+0.5rem)] right-0 grid w-44 grid-cols-2 gap-1.5 rounded-2xl border border-white/10 bg-night-900/95 p-1.5 shadow-2xl backdrop-blur-xl"
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => { haptic(); onStop(); setMoreOpen(false); }}
                  className="flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl text-xs font-semibold text-slate-200 transition hover:bg-white/10 active:scale-[0.98]"
                >
                  <span className="text-base leading-none" aria-hidden="true">■</span>
                  {t('player.controls.stop')}
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => { haptic(); onShuffleToggle(); setMoreOpen(false); }}
                  className={`flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl text-xs font-semibold transition hover:bg-white/10 active:scale-[0.98] ${
                    shuffle ? 'text-neon-violet' : 'text-slate-200'
                  }`}
                >
                  <span className="text-xl leading-none" aria-hidden="true">⇄</span>
                  {t('player.controls.shuffle')}
                </button>
              </div>
            )}
            <button
              type="button"
              onClick={() => { haptic(); setMoreOpen((open) => !open); }}
              aria-expanded={moreOpen}
              aria-label={t('player.controls.more')}
              title={t('player.controls.more')}
              className="flex h-[52px] w-[52px] items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-200 transition hover:border-neon-cyan/50 hover:text-neon-cyan active:scale-90"
            >
              <span className="-mt-2 text-2xl leading-none" aria-hidden="true">•••</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
