'use client';

interface Props {
  /** Pre-warm progress (cloud TTS caching), or null when idle. Purely informational. */
  prewarm: { done: number; total: number } | null;
  /** Brief post-warm-up summary, or null. Auto-dismissed by the caller. */
  summary?: string | null;
}

/**
 * Tiny, non-intrusive warm-up indicator: a cyan "Caching audio… X/Y" pill while
 * blobs are being generated, and an amber "x of y cached" summary when some
 * words failed. Shared by the player's Loop-settings row and the speed
 * challenge intro. Never gates or blocks playback — it is informational only.
 */
export default function PrewarmStatus({ prewarm, summary = null }: Props) {
  return (
    <>
      {prewarm && (
        <span
          role="status"
          aria-live="polite"
          title={`Caching audio for offline / lock-screen playback — ${prewarm.done} of ${prewarm.total} done`}
          className="flex items-center gap-1.5 rounded-full border border-neon-cyan/30 bg-neon-cyan/10 px-3 py-1.5 text-[11px] font-medium text-neon-cyan"
        >
          <span className="h-3 w-3 animate-spin rounded-full border border-neon-cyan/30 border-t-neon-cyan" />
          Caching audio… {prewarm.done}/{prewarm.total}
        </span>
      )}
      {summary && (
        <span
          role="status"
          aria-live="polite"
          className="flex items-center gap-1.5 rounded-full border border-neon-amber/40 bg-neon-amber/10 px-3 py-1.5 text-[11px] font-medium text-neon-amber"
        >
          {summary}
        </span>
      )}
    </>
  );
}
