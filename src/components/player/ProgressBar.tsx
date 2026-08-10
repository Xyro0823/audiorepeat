'use client';

interface Props {
  wordIndex: number;
  repeatIndex: number;
  isTranslation: boolean;
  repeats: number;
  total: number;
}

export default function ProgressBar({ wordIndex, repeatIndex, isTranslation, repeats, total }: Props) {
  const value =
    total === 0
      ? 0
      : Math.min(1, (wordIndex + (isTranslation ? 0.9 : repeatIndex / Math.max(1, repeats))) / total);
  const label = total === 0 ? '0 / 0' : `${wordIndex + 1} / ${total}`;

  return (
    <div className="mx-auto mt-8 w-full max-w-md">
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-night-800">
        <div
          className="h-full rounded-full bg-gradient-to-r from-neon-cyan to-neon-violet transition-all duration-500"
          style={{ width: `${value * 100}%` }}
        />
      </div>
      <div className="mt-2 flex justify-between text-[11px] text-slate-500">
        <span>{label}</span>
        <span>{Math.round(value * 100)}%</span>
      </div>
    </div>
  );
}
