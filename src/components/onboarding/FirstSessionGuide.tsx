'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { usePathname } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  Brain,
  CalendarClock,
  Check,
  Headphones,
  X,
} from 'lucide-react';
import {
  dismissFirstSessionGuide,
  getFirstSessionGuideSnapshot,
  parseFirstSessionGuideRecord,
  saveFirstSessionGuideStep,
  shouldShowFirstSessionGuide,
  subscribeFirstSessionGuide,
} from '@/lib/firstSessionGuide';
import {
  getOnboardingPendingVersion,
  readOnboardingPending,
  readOnboardingRecord,
  subscribeOnboardingPending,
} from '@/lib/onboarding';

interface Props {
  uid: string;
}

const GUIDE_STEPS = [
  {
    eyebrow: 'Listen',
    title: 'Let the loop do the work',
    description:
      'Press Play once. AudioRepeat cycles through the target word and translation, then moves forward hands-free.',
    icon: Headphones,
    detail: (
      <div className="flex items-end justify-center gap-1.5" aria-hidden>
        {[12, 22, 32, 18, 27, 14, 24].map((height, index) => (
          <span
            key={`${height}-${index}`}
            className="w-1.5 rounded-full bg-neon-cyan/75"
            style={{ height }}
          />
        ))}
      </div>
    ),
  },
  {
    eyebrow: 'Decide',
    title: 'Teach the app what needs work',
    description:
      'Use Known when recall feels easy. Use Review when a word needs another pass—this keeps your daily queue useful.',
    icon: Brain,
    detail: (
      <div className="grid grid-cols-2 gap-2 text-center text-xs font-semibold">
        <span className="rounded-xl border border-neon-green/25 bg-neon-green/[0.08] px-3 py-2.5 text-neon-green">
          <Check className="mr-1 inline h-3.5 w-3.5" aria-hidden /> Known
        </span>
        <span className="rounded-xl border border-neon-violet/25 bg-neon-violet/[0.08] px-3 py-2.5 text-neon-violet">
          Review sooner
        </span>
      </div>
    ),
  },
  {
    eyebrow: 'Return',
    title: 'Come back to Review Today',
    description:
      'Your difficult words reappear when they are most useful to practise. A short daily session is enough to keep momentum.',
    icon: CalendarClock,
    detail: (
      <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-night-950/50 px-3 py-2.5">
        <span className="text-xs font-semibold text-slate-300">Next smart review</span>
        <span className="rounded-full bg-neon-cyan/10 px-2.5 py-1 text-[11px] font-bold text-neon-cyan">
          Review Today
        </span>
      </div>
    ),
  },
] as const;

/**
 * A small, non-blocking coach card shown only during a newly onboarded
 * account's first player visit. It teaches the practice loop—not the language,
 * level, goal or library setup already covered elsewhere.
 */
export default function FirstSessionGuide({ uid }: Props) {
  const pathname = usePathname();
  useSyncExternalStore(
    subscribeOnboardingPending,
    getOnboardingPendingVersion,
    getOnboardingPendingVersion,
  );
  const rawRecord = useSyncExternalStore(
    subscribeFirstSessionGuide,
    () => getFirstSessionGuideSnapshot(uid),
    () => null,
  );
  const guideRecord = parseFirstSessionGuideRecord(rawRecord);
  const onboardingRecord = readOnboardingRecord(uid);
  const visible = shouldShowFirstSessionGuide({
    pathname,
    onboardingPending: readOnboardingPending(uid),
    onboardingCompleted: onboardingRecord?.completed === true,
    dismissed: guideRecord.dismissed,
  });
  const step = guideRecord.step;
  const content = GUIDE_STEPS[step];
  const Icon = content.icon;

  useEffect(() => {
    if (!visible) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') dismissFirstSessionGuide(uid);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [uid, visible]);

  if (!visible) return null;

  const lastStep = step === GUIDE_STEPS.length - 1;

  return (
    <aside
      role="dialog"
      aria-modal="false"
      aria-live="polite"
      aria-labelledby="first-session-guide-title"
      aria-describedby="first-session-guide-description"
      className="fixed inset-x-3 bottom-[calc(7.75rem+env(safe-area-inset-bottom))] z-[120] mx-auto max-h-[calc(100dvh_-_9rem_-_env(safe-area-inset-bottom))] max-w-sm overflow-y-auto rounded-3xl border border-white/15 bg-night-800/95 p-4 text-white shadow-[0_22px_70px_rgba(0,0,0,0.58)] backdrop-blur-xl motion-safe:animate-fade-up sm:inset-x-auto sm:bottom-36 sm:right-5 sm:w-[23rem] sm:max-w-[calc(100vw-2.5rem)] sm:p-5"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-neon-cyan/20 bg-neon-cyan/[0.08] text-neon-cyan">
          <Icon className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1 pt-0.5">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-neon-cyan">
            First loop · {content.eyebrow}
          </p>
          <h2 id="first-session-guide-title" className="mt-1 text-base font-bold tracking-tight text-white">
            {content.title}
          </h2>
        </div>
        <button
          type="button"
          onClick={() => dismissFirstSessionGuide(uid)}
          aria-label="Skip first-session guide"
          title="Skip guide"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-400 transition hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>

      <p id="first-session-guide-description" className="mt-3 text-sm leading-6 text-slate-300">
        {content.description}
      </p>

      <div className="mt-3 rounded-2xl border border-white/[0.08] bg-white/[0.035] p-3">
        {content.detail}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5" aria-label={`Step ${step + 1} of ${GUIDE_STEPS.length}`}>
          {GUIDE_STEPS.map((item, index) => (
            <span
              key={item.eyebrow}
              className={`h-1.5 rounded-full transition-[width,background-color] ${
                index === step ? 'w-6 bg-neon-cyan' : 'w-1.5 bg-white/20'
              }`}
              aria-hidden
            />
          ))}
        </div>

        <div className="flex items-center gap-2">
          {step > 0 && (
            <button
              type="button"
              onClick={() => saveFirstSessionGuideStep(uid, step - 1)}
              className="flex min-h-11 items-center gap-1 rounded-xl px-3 text-xs font-semibold text-slate-400 transition hover:bg-white/[0.05] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Back
            </button>
          )}
          <button
            type="button"
            onClick={() =>
              lastStep
                ? dismissFirstSessionGuide(uid)
                : saveFirstSessionGuideStep(uid, step + 1)
            }
            className="flex min-h-11 items-center gap-1.5 rounded-xl bg-neon-cyan px-4 text-xs font-bold text-night-950 transition hover:brightness-110 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-night-800"
          >
            {lastStep ? 'Got it' : 'Next'}
            {!lastStep && <ArrowRight className="h-3.5 w-3.5" aria-hidden />}
          </button>
        </div>
      </div>
    </aside>
  );
}
