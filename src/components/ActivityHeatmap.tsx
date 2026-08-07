'use client';

import type { DayCell } from '@/lib/practiceStats';
import { formatDuration } from '@/lib/format';

// 0 = no practice, 1-4 = increasing intensity (scaled against the week max).
export const HEATMAP_LEVEL_CLASSES = [
  'bg-night-700/50',
  'bg-neon-cyan/25',
  'bg-neon-cyan/55',
  'bg-neon-green/70',
  'bg-neon-green',
];

export function heatmapLevel(words: number, max: number): number {
  if (words <= 0 || max <= 0) return 0;
  return Math.min(4, Math.max(1, Math.ceil((words / max) * 4)));
}

export function heatmapCellTitle(cell: DayCell): string {
  const head = cell.isToday ? 'Today' : `${cell.weekday} ${cell.dayOfMonth}`;
  if (cell.words <= 0 && cell.ms <= 0) return `${head} — no practice`;
  return `${head} — ${cell.words} word${cell.words === 1 ? '' : 's'} · ${formatDuration(cell.ms)}`;
}

export default function ActivityHeatmap({ week }: { week: DayCell[] }) {
  const maxWords = Math.max(0, ...week.map((d) => d.words));

  return (
    <div className="mt-4 border-t border-white/5 pt-4">
      <div className="flex items-center justify-center gap-1.5">
        {week.map((cell) => (
          <div key={cell.key} className="flex w-full max-w-14 flex-col items-center gap-1">
            <div
              title={heatmapCellTitle(cell)}
              className={`h-8 w-full rounded-lg transition-colors duration-300 ${
                HEATMAP_LEVEL_CLASSES[heatmapLevel(cell.words, maxWords)]
              } ${cell.isToday ? 'ring-1 ring-neon-cyan/60 ring-offset-1 ring-offset-night-900' : ''}`}
            />
            <span className="text-[9px] font-medium text-slate-600">{cell.weekday}</span>
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-end gap-1 text-[10px] text-slate-600">
        <span>Less</span>
        {HEATMAP_LEVEL_CLASSES.map((cls, i) => (
          <span key={i} className={`h-2.5 w-2.5 rounded-sm ${cls}`} />
        ))}
        <span>More</span>
      </div>
    </div>
  );
}
