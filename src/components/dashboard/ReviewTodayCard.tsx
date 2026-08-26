'use client';

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { estimatedReviewMinutes } from '@/lib/review/fsrs';
import {
  classifyNextDue,
  formatNextDueDate,
  nextDueCopy,
} from '@/lib/review/nextDue';
import { currentUiLang } from '@/lib/i18n';
import { scheduleDailyReminder } from '@/lib/reminders';
import { useT } from '@/lib/i18n';

interface Props {
  dueCount: number;
  /** Earliest future due timestamp in the library (null = nothing scheduled). */
  nextDueAtMs?: number | null;
  reminderEnabled: boolean;
  reminderTime: string;
  onStart: () => void;
  onSettingsChange: (patch: { reminderEnabled?: boolean; reminderTime?: string }) => void;
}

const subscribeHydration = () => () => {};

export default function ReviewTodayCard({
  dueCount,
  nextDueAtMs,
  reminderEnabled,
  reminderTime,
  onStart,
  onSettingsChange,
}: Props) {
  const t = useT();
  const [message, setMessage] = useState<string | null>(null);
  const hydrated = useSyncExternalStore(subscribeHydration, () => true, () => false);
  const notificationSupported =
    hydrated && 'Notification' in window && 'serviceWorker' in navigator;

  // Next-study guidance for the caught-up state: tells the learner exactly
  // when their queue refills, so "0 due" still carries a return cue.
  // `nextDueAtMs` is produced by nextDueAt(), which only ever returns future
  // timestamps, so no wall-clock check is needed here.
  const nextDueLine = useMemo(() => {
    if (dueCount > 0 || !hydrated || typeof nextDueAtMs !== 'number') return null;
    const copy = nextDueCopy(classifyNextDue(nextDueAtMs));
    return t(
      copy.key,
      copy.date
        ? { ...copy.vars, date: formatNextDueDate(copy.date, currentUiLang()) }
        : copy.vars,
    );
  }, [dueCount, hydrated, nextDueAtMs, t]);

  useEffect(() => {
    void scheduleDailyReminder(reminderEnabled, reminderTime, dueCount);
  }, [dueCount, reminderEnabled, reminderTime]);

  const toggleReminder = useCallback(async () => {
    if (reminderEnabled) {
      onSettingsChange({ reminderEnabled: false });
      setMessage(t('dashboard.reminder.msg.off'));
      return;
    }
    if (!notificationSupported) {
      setMessage(t('dashboard.reminder.msg.needPwa'));
      return;
    }
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      setMessage(t('dashboard.reminder.msg.blocked'));
      return;
    }
    onSettingsChange({ reminderEnabled: true });
    setMessage(t('dashboard.reminder.msg.set', { time: reminderTime }));
  }, [notificationSupported, onSettingsChange, reminderEnabled, reminderTime, t]);

  return (
    <section
      id="review-today"
      className="glass animate-fade-up scroll-mt-28 overflow-hidden rounded-3xl border border-neon-violet/20 md:scroll-mt-6"
      aria-labelledby="review-today-title"
    >
      <div className="grid gap-0 md:grid-cols-[minmax(0,1fr)_220px]">
        <div className="flex items-center gap-5 p-5 sm:p-6">
          <div className="relative flex h-20 w-20 shrink-0 items-center justify-center rounded-full border border-neon-violet/25 bg-night-900/70">
            <span className="absolute inset-2 rounded-full border border-dashed border-neon-cyan/30" aria-hidden />
            <span className="relative text-3xl font-bold tabular-nums text-white">{dueCount}</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-neon-violet">{t('dashboard.review.memoryQueue')}</p>
            <h2 id="review-today-title" className="mt-1 text-xl font-bold tracking-tight text-white">
              {t('dashboard.reviewToday')}
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-slate-400">
              {dueCount > 0
                ? t(
                    dueCount === 1 ? 'dashboard.review.due.one' : 'dashboard.review.due.other',
                    { count: dueCount, minutes: estimatedReviewMinutes(dueCount) },
                  )
                : (nextDueLine ?? t('dashboard.review.caughtUp'))}
            </p>
          </div>
          <button
            type="button"
            onClick={onStart}
            disabled={dueCount === 0}
            className="hidden min-h-11 shrink-0 rounded-xl bg-neon-violet px-5 text-sm font-bold text-white transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-violet disabled:cursor-not-allowed disabled:opacity-35 sm:block"
          >
            {t('dashboard.review.start')}
          </button>
        </div>

        <div className="border-t border-white/10 bg-white/[0.025] p-4 md:border-l md:border-t-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">{t('dashboard.reminder.title')}</p>
          <div className="mt-2 flex items-center gap-2">
            <input
              type="time"
              aria-label={t('dashboard.reminder.timeAria')}
              value={reminderTime}
              onChange={(event) => onSettingsChange({ reminderTime: event.target.value })}
              className="min-h-10 min-w-0 flex-1 rounded-xl border border-white/10 bg-night-900 px-3 text-sm text-white outline-none focus:border-neon-cyan/50"
            />
            <button
              type="button"
              aria-pressed={reminderEnabled}
              onClick={() => void toggleReminder()}
              className={`min-h-10 rounded-xl border px-3 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan ${
                reminderEnabled
                  ? 'border-neon-green/35 bg-neon-green/10 text-neon-green'
                  : 'border-white/10 text-slate-300 hover:border-neon-cyan/35 hover:text-white'
              }`}
            >
              {reminderEnabled ? t('dashboard.reminder.on') : t('dashboard.reminder.enable')}
            </button>
          </div>
          <p className="mt-2 text-[10px] leading-relaxed text-slate-500">
            {message ??
              (reminderEnabled
                ? t('dashboard.reminder.next', { time: reminderTime })
                : t('dashboard.reminder.hint'))}
          </p>
        </div>
      </div>

      <div className="px-5 pb-5 sm:hidden">
        <button
          type="button"
          onClick={onStart}
          disabled={dueCount === 0}
          className="min-h-11 w-full rounded-xl bg-neon-violet px-5 text-sm font-bold text-white transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-35"
        >
          {t('dashboard.review.start')}
        </button>
      </div>
    </section>
  );
}
