'use client';

import { useT } from '@/lib/i18n';

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
  const cycleSpeed = () => {
    // Snaps non-preset values (e.g. 1.3 from the fine-grained settings slider)
    // to the first preset on the next tap.
    const i = SPEED_OPTIONS.findIndex((s) => Math.abs(s - speed) < 0.001);
    onSpeedChange(SPEED_OPTIONS[(i + 1) % SPEED_OPTIONS.length]);
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/5 bg-night-950/80 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl">
      {/* Mobile: two stacked rows so all six controls fit 320–438px without
          squashing the round buttons; sm+ restores the single centered dock. */}
      <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-2 px-4 py-4 sm:flex-row sm:justify-center sm:gap-5 sm:py-5">
        <div className="flex items-center justify-center gap-4 sm:gap-5">
        <button
          onClick={onBack}
          aria-label={backAction === 'previous' ? t('player.controls.prevAria') : t('player.controls.replayAria')}
          title={backAction === 'previous' ? t('player.controls.prevTitle') : t('player.controls.replayAria')}
          className="flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-200 transition hover:border-neon-cyan/50 hover:text-neon-cyan active:scale-90"
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
          onClick={onPlayPause}
          aria-label={isPlaying ? t('player.controls.pause') : t('player.controls.play')}
          className={`relative flex h-20 w-20 items-center justify-center rounded-full text-night-950 transition active:scale-90 ${
            isPlaying
              ? 'bg-gradient-to-br from-neon-cyan to-neon-violet'
              : 'bg-gradient-to-br from-neon-cyan to-neon-violet animate-pulse-glow'
          }`}
        >
          {isPlaying ? (
            <svg viewBox="0 0 24 24" className="h-8 w-8" fill="currentColor">
              <rect x="6" y="5" width="4" height="14" rx="1" />
              <rect x="14" y="5" width="4" height="14" rx="1" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" className="h-8 w-8 translate-x-0.5" fill="currentColor">
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
          onClick={onSkipNext}
          aria-label={t('player.controls.nextWord')}
          title={t('player.controls.nextWord')}
          className="flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-200 transition hover:border-neon-cyan/50 hover:text-neon-cyan active:scale-90"
        >
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor">
            <path d="M5 5.5v13a1 1 0 0 0 1.5.87l10-6.5a1 1 0 0 0 0-1.74l-10-6.5A1 1 0 0 0 5 5.5Z" />
            <rect x="17" y="5" width="2.2" height="14" rx="1" />
          </svg>
        </button>
        </div>

        {/* Secondary transport — own row on mobile, inline on sm+ */}
        <div className="flex items-center justify-center gap-4 sm:gap-5">
          <button
            onClick={onStop}
            aria-label={t('player.controls.stop')}
            title={t('player.controls.stop')}
            className="flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-300 transition hover:border-neon-magenta/50 hover:text-neon-magenta active:scale-90"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
          </button>

        <button
          onClick={cycleSpeed}
          aria-label={t('player.controls.speedAria', { speed })}
          title={t('player.controls.speedTitle')}
          className={`flex h-14 shrink-0 flex-col items-center justify-center gap-1 rounded-full border px-4 transition active:scale-90 ${
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
          onClick={onShuffleToggle}
          aria-pressed={shuffle}
          aria-label={shuffle ? t('player.controls.shuffleOn') : t('player.controls.shuffleOff')}
          title={shuffle ? t('player.controls.shuffleOn') : t('player.controls.shuffleOff')}
          className={`flex h-14 w-14 items-center justify-center rounded-full border transition active:scale-90 ${
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
        </div>
      </div>
    </div>
  );
}
