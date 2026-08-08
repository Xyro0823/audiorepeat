/**
 * Minimal language badge — a country flag accent with clean typography.
 * Replaces the cartoon dioramas with an elegant, professional touch.
 */

const FLAGS: Record<string, string> = {
  ar: '🇪🇬',
  zh: '🇨🇳',
  cs: '🇨🇿',
  da: '🇩🇰',
  nl: '🇳🇱',
  fil: '🇵🇭',
  fi: '🇫🇮',
  fr: '🇫🇷',
  de: '🇩🇪',
  en: '🇬🇧',
  ja: '🇯🇵',
  es: '🇪🇸',
  ms: '🇲🇾',
  it: '🇮🇹',
  hi: '🇮🇳',
  tr: '🇹🇷',
  ru: '🇷🇺',
  pt: '🇵🇹',
  ko: '🇰🇷',
  th: '🇹🇭',
  pl: '🇵🇱',
  el: '🇬🇷',
  sv: '🇸🇪',
  no: '🇳🇴',
  vi: '🇻🇳',
  id: '🇮🇩',
  uk: '🇺🇦',
  he: '🇮🇱',
  fa: '🇮🇷',
  hu: '🇭🇺',
  ro: '🇷🇴',
  bg: '🇧🇬',
  hr: '🇭🇷',
  sk: '🇸🇰',
  sl: '🇸🇮',
  sr: '🇷🇸',
  lt: '🇱🇹',
  lv: '🇱🇻',
  et: '🇪🇪',
  is: '🇮🇸',
  ga: '🇮🇪',
  cy: '🏴',
  bn: '🇧🇩',
  ur: '🇵🇰',
  ta: '🇮🇳',
  te: '🇮🇳',
  kn: '🇮🇳',
  ml: '🇮🇳',
  mr: '🇮🇳',
  gu: '🇮🇳',
  pa: '🇮🇳',
  sw: '🇰🇪',
  am: '🇪🇹',
  ha: '🇳🇬',
  yo: '🇳🇬',
  ig: '🇳🇬',
  zu: '🇿🇦',
  xh: '🇿🇦',
  af: '🇿🇦',
  sq: '🇦🇱',
  hy: '🇦🇲',
  az: '🇦🇿',
  eu: '🇪🇸',
  be: '🇧🇾',
  bs: '🇧🇦',
  ca: '🇪🇸',
  ka: '🇬🇪',
  kk: '🇰🇿',
  ky: '🇰🇬',
  mk: '🇲🇰',
  mn: '🇲🇳',
  ne: '🇳🇵',
  si: '🇱🇰',
  km: '🇰🇭',
  lo: '🇱🇦',
  my: '🇲🇲',
  tl: '🇵🇭',
  uz: '🇺🇿',
  tk: '🇹🇲',
  tg: '🇹🇯',
};

function flagFor(code: string): string | null {
  const base = code.trim().toLowerCase().split('-')[0];
  return FLAGS[base] ?? null;
}

/** Compact base-language tag, e.g. "es-ES" → "ES". */
function tagFor(code: string): string {
  return code.trim().split('-')[0].toUpperCase();
}

interface Props {
  lang: string;
  label: string;
  /** "lg" shows the label next to the flag; "sm" is a compact chip. */
  size?: 'sm' | 'lg';
  className?: string;
}

/**
 * Elegant language identifier: flag emoji + short code in a faint glass chip
 * (or a label row at `lg` size). Pure typography — no illustrations.
 */
export default function LanguageBadge({ lang, label, size = 'sm', className = '' }: Props) {
  const flag = flagFor(lang);
  if (size === 'lg') {
    return (
      <span className={`inline-flex items-center gap-2 text-sm text-slate-400 ${className}`}>
        <span className="text-base leading-none">{flag ?? '🌐'}</span>
        <span className="truncate">{label}</span>
      </span>
    );
  }
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-[11px] font-medium tracking-wide text-slate-400 ${className}`}
      title={label}
    >
      <span className="text-sm leading-none">{flag ?? '🌐'}</span>
      {tagFor(lang)}
    </span>
  );
}
