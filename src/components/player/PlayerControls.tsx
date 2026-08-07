'use client';

interface Props {
  isPlaying: boolean;
  onPlayPause: () => void;
  onStop: () => void;
  onSkipNext: () => void;
  onReplay: () => void;
}

export default function PlayerControls({
  isPlaying,
  onPlayPause,
  onStop,
  onSkipNext,
  onReplay,
}: Props) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/5 bg-night-950/80 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-3xl items-center justify-center gap-5 px-5 py-5">
        <button
          onClick={onReplay}
          aria-label="Replay current word"
          title="Replay current word"
          className="flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-200 transition hover:border-neon-cyan/50 hover:text-neon-cyan active:scale-90"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-6 w-6"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 12a9 9 0 1 0 3-6.7" />
            <path d="M3 4v5h5" />
          </svg>
        </button>

        <button
          onClick={onPlayPause}
          aria-label={isPlaying ? 'Pause' : 'Play'}
          className={`relative flex h-20 w-20 items-center justify-center rounded-full text-night-950 transition active:scale-90 ${
            isPlaying
              ? 'bg-gradient-to-br from-neon-magenta to-neon-violet glow-magenta'
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
                  className="eq-bar w-1 rounded-sm bg-neon-magenta"
                  style={{ height: '100%', animationDelay: `${i * 0.18}s` }}
                />
              ))}
            </span>
          )}
        </button>

        <button
          onClick={onSkipNext}
          aria-label="Skip to next word"
          title="Skip to next word"
          className="flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-200 transition hover:border-neon-cyan/50 hover:text-neon-cyan active:scale-90"
        >
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor">
            <path d="M5 5.5v13a1 1 0 0 0 1.5.87l10-6.5a1 1 0 0 0 0-1.74l-10-6.5A1 1 0 0 0 5 5.5Z" />
            <rect x="17" y="5" width="2.2" height="14" rx="1" />
          </svg>
        </button>

        <button
          onClick={onStop}
          aria-label="Stop"
          title="Stop"
          className="flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-300 transition hover:border-neon-magenta/50 hover:text-neon-magenta active:scale-90"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
            <rect x="6" y="6" width="12" height="12" rx="2" />
          </svg>
        </button>
      </div>
    </div>
  );
}
