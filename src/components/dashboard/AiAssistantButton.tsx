'use client';

import { useT } from '@/lib/i18n';

interface Props {
  /** Called when the assistant button is tapped (e.g. reveal the AI insights card). */
  onOpen: () => void;
  /** Optional label for screen readers — defaults to a generic assistant label. */
  label?: string;
}

/**
 * Floating AI assistant button — a 56px circular trigger in the bottom-right
 * corner with a deep blue→cyan gradient, a subtle idle bounce, and a white
 * sparkle icon. The bounce lives on an outer wrapper so the button's own
 * hover/active transforms aren't overridden by the animation.
 */
export default function AiAssistantButton({ onOpen, label }: Props) {
  const t = useT();
  const resolvedLabel = label ?? t('dashboard.aiAssistant.open');
  return (
    <div className="animate-ai-bounce fixed bottom-6 right-6 z-50">
      <button
        type="button"
        onClick={onOpen}
        aria-label={resolvedLabel}
        title={resolvedLabel}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-[0_10px_32px_rgba(2,132,199,0.45),inset_0_1px_0_rgba(255,255,255,0.35)] ring-1 ring-white/25 transition-transform duration-150 hover:scale-110 active:scale-95"
      >
        {/* Sparkle / AI icon */}
        <svg
          viewBox="0 0 24 24"
          className="h-6 w-6"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M12 2.5c.4 2.9 1.5 4.9 3.4 6.6 1.9 1.6 3.9 2.5 6.1 2.9-2.2.4-4.2 1.3-6.1 2.9-1.9 1.7-3 3.7-3.4 6.6-.4-2.9-1.5-4.9-3.4-6.6C7.7 13.3 5.7 12.4 3.5 12c2.2-.4 4.2-1.3 6.1-2.9 1.9-1.7 3-3.7 3.4-6.6Z" />
          <path d="M19 16.5c.15 1.1.55 1.9 1.25 2.5-.7.6-1.1 1.4-1.25 2.5-.15-1.1-.55-1.9-1.25-2.5.7-.6 1.1-1.4 1.25-2.5Z" />
        </svg>
      </button>
    </div>
  );
}
