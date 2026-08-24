'use client';

import { useRef, useState } from 'react';
import { useT } from '@/lib/i18n';

interface Props {
  wordIndex: number;
  repeatIndex: number;
  isTranslation: boolean;
  repeats: number;
  total: number;
  onSeek: (wordIndex: number) => void;
  onOpenNavigator: () => void;
}

export default function ProgressBar({
  wordIndex,
  repeatIndex,
  isTranslation,
  repeats,
  total,
  onSeek,
  onOpenNavigator,
}: Props) {
  const t = useT();
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const previewRef = useRef<number | null>(null);
  const playbackValue =
    total === 0
      ? 0
      : Math.min(1, (wordIndex + (isTranslation ? 0.9 : repeatIndex / Math.max(1, repeats))) / total);
  const shownIndex = previewIndex ?? wordIndex;
  const value = previewIndex === null
    ? playbackValue
    : total <= 1 ? 0 : previewIndex / (total - 1);
  const label = total === 0 ? '0 / 0' : `${shownIndex + 1} / ${total}`;

  const preview = (index: number) => {
    previewRef.current = index;
    setPreviewIndex(index);
  };
  const commit = () => {
    const index = previewRef.current;
    if (index === null) return;
    previewRef.current = null;
    setPreviewIndex(null);
    onSeek(index);
  };
  const cancel = () => {
    previewRef.current = null;
    setPreviewIndex(null);
  };

  return (
    <div className="mx-auto mt-8 w-full max-w-md">
      <div className="relative h-8 w-full">
        <input
          type="range"
          min={0}
          max={Math.max(0, total - 1)}
          step={1}
          value={shownIndex}
          disabled={total === 0}
          aria-label={t('player.progress.jumpAria')}
          aria-valuetext={label}
          onChange={(event) => preview(Number(event.currentTarget.value))}
          onPointerUp={commit}
          onPointerCancel={cancel}
          onKeyUp={commit}
          onBlur={commit}
          className="peer absolute inset-0 z-10 h-8 w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
        />
        <div className="pointer-events-none absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 overflow-hidden rounded-full bg-night-800 ring-neon-cyan/70 transition peer-focus-visible:ring-2 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-night-950">
        <div
          className="h-full rounded-full bg-gradient-to-r from-neon-cyan to-neon-violet transition-all duration-500"
          style={{ width: `${value * 100}%` }}
        />
        </div>
      </div>
      <div className="flex items-center justify-between text-[11px] text-slate-500">
        <button
          type="button"
          onClick={onOpenNavigator}
          disabled={total === 0}
          className="-ml-2 min-h-11 rounded-lg px-2 text-left transition hover:bg-white/5 hover:text-neon-cyan focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan disabled:cursor-not-allowed disabled:opacity-50"
          aria-label={t('player.progress.openSearchAria', { label })}
        >
          <span className="font-semibold text-slate-300">{label}</span>
          <span className="ml-2">{t('player.nav.title')}</span>
        </button>
        <span>{Math.round(value * 100)}%</span>
      </div>
    </div>
  );
}
