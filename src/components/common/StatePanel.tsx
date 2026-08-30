import type { ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Inbox, LoaderCircle, type LucideIcon } from 'lucide-react';

type StateKind = 'loading' | 'empty' | 'success' | 'error';

const stateStyle: Record<StateKind, { Icon: LucideIcon; icon: string; eyebrow: string }> = {
  loading: {
    Icon: LoaderCircle,
    icon: 'border-neon-cyan/25 bg-neon-cyan/10 text-neon-cyan',
    eyebrow: 'text-neon-cyan',
  },
  empty: {
    Icon: Inbox,
    icon: 'border-neon-violet/25 bg-neon-violet/10 text-neon-violet',
    eyebrow: 'text-neon-violet',
  },
  success: {
    Icon: CheckCircle2,
    icon: 'border-neon-green/25 bg-neon-green/10 text-neon-green',
    eyebrow: 'text-neon-green',
  },
  error: {
    Icon: AlertTriangle,
    icon: 'border-neon-magenta/25 bg-neon-magenta/10 text-neon-magenta',
    eyebrow: 'text-neon-magenta',
  },
};

/** A consistent, accessible state for waiting, empty, complete and recoverable-error screens. */
export default function StatePanel({
  kind,
  eyebrow,
  title,
  description,
  action,
  compact = false,
  headingAs = 'h2',
}: {
  kind: StateKind;
  eyebrow?: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  compact?: boolean;
  headingAs?: 'h1' | 'h2' | 'h3';
}) {
  const { Icon, icon, eyebrow: eyebrowColor } = stateStyle[kind];
  const isLoading = kind === 'loading';
  const Heading = headingAs;

  return (
    <section
      aria-live={isLoading ? 'polite' : kind === 'error' ? 'assertive' : 'polite'}
      aria-busy={isLoading || undefined}
      className={`glass-card mx-auto w-full max-w-xl rounded-3xl border border-white/10 text-center shadow-[0_18px_60px_rgba(0,0,0,0.2)] ${
        compact ? 'p-6' : 'p-8 sm:p-10'
      }`}
    >
      <span className={`mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border ${icon}`} aria-hidden>
        <Icon className={`h-7 w-7 ${isLoading ? 'animate-spin' : ''}`} strokeWidth={1.8} />
      </span>
      {eyebrow && (
        <p className={`mt-5 text-[11px] font-bold uppercase tracking-[0.22em] ${eyebrowColor}`}>{eyebrow}</p>
      )}
      {title && <Heading className="mt-2 text-xl font-bold tracking-tight text-white sm:text-2xl">{title}</Heading>}
      {description && <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-slate-400">{description}</p>}
      {action && <div className="mt-6 flex flex-wrap justify-center gap-3">{action}</div>}
    </section>
  );
}
