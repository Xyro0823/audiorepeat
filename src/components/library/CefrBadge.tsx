import { CEFR_META } from '@/lib/starterSets';
import type { CefrLevel } from '@/types/app';

/** Color-coded CEFR badge: green (A1/A2), cyan (B1/B2), violet (C1), gold (C2). */
export default function CefrBadge({
  level,
  className = '',
}: {
  level: CefrLevel;
  className?: string;
}) {
  const meta = CEFR_META[level];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold tracking-wide ${meta.badge} ${className}`}
    >
      {level}
      <span className="opacity-80">{meta.label}</span>
    </span>
  );
}
