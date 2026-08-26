'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLists } from '@/hooks/useLists';
import { useAuth } from '@/hooks/useAuth';
import { usePracticeStats } from '@/hooks/usePracticeStats';
import { useSpeechVoices } from '@/hooks/useSpeechVoices';
import { useCloudTtsStatus } from '@/hooks/useCloudTtsStatus';
import DowngradeModal from '@/components/checkout/DowngradeModal';
import { buildBackup, downloadBackup, parseBackup, type BackupData } from '@/lib/sets/backup';
import { statsStorageKey, usernameStorageKey } from '@/lib/auth/scopes';
import { requestProgressReplace } from '@/lib/sync/client';
import { isProPlan, FREE_LANG_LIMIT, PLAN_BADGE, planDetail, planHasFeature } from '@/lib/plans';
import { FREE_LANG_OPTIONS, SUPPORTED_LANGUAGE_COUNT } from '@/lib/freeLang';
import { findLanguage } from '@/lib/languages';
import { buildDueReviewQueue } from '@/lib/review/fsrs';
import { scheduleDailyReminder, sendReminderTest } from '@/lib/reminders';
import type { ThemeName } from '@/types/app';
import { DEFAULT_SETTINGS } from '@/types/app';
import { setUiLang, UI_LANGUAGES, useT } from '@/lib/i18n';
import VoicePicker from '@/components/player/VoicePicker';
import ChangeFreeLanguageModal from '@/components/onboarding/ChangeFreeLanguageModal';
import useDialogA11y from '@/hooks/useDialogA11y';

const REPEAT_OPTIONS = [1, 2, 3, 5];
const SPEED_OPTIONS = [0.75, 1, 1.25, 1.5, 2];

const THEME_LABEL_KEYS = {
  neon: 'settings.theme.neon.label',
  dark: 'settings.theme.dark.label',
  light: 'settings.theme.light.label',
} as const;
const THEME_DESC_KEYS = {
  neon: 'settings.theme.neon.desc',
  dark: 'settings.theme.dark.desc',
  light: 'settings.theme.light.desc',
} as const;

const THEMES: { id: ThemeName; swatches: string[] }[] = [
  {
    id: 'neon',
    swatches: ['#0b0c10', '#3b82f6', '#38bdf8'],
  },
  {
    id: 'dark',
    swatches: ['#0b0c10', '#38bdf8', '#0ea5e9'],
  },
  {
    id: 'light',
    swatches: ['#f6f7fb', '#0891b2', '#2563eb'],
  },
];

type Tab = 'language' | 'playback' | 'appearance' | 'data' | 'reminders';

function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      role="switch"
      aria-checked={checked}
      className="flex w-full items-center gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan"
    >
      <span
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
          checked ? 'bg-neon-cyan' : 'bg-night-600'
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
            checked ? 'left-[22px]' : 'left-0.5'
          }`}
        />
      </span>
      <span>
        <span className="block text-sm text-slate-300">{label}</span>
        {hint && <span className="block text-[11px] text-slate-500">{hint}</span>}
      </span>
    </button>
  );
}

const inputClass =
  'w-full rounded-xl border border-white/10 bg-night-800/80 px-4 py-2.5 text-white placeholder:text-slate-600 outline-none transition focus:border-neon-cyan/60';

interface Props {
  onClose: () => void;
}

function RestoreConfirmOverlay({
  t,
  count,
  onConfirm,
  onCancel,
}: {
  t: ReturnType<typeof useT>;
  count: number;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const dialogRef = useDialogA11y<HTMLDivElement>(true, onCancel);
  return (
    <div
      ref={dialogRef}
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={t('settings.restore.question')}
    >
      <div className="glass animate-fade-up w-full max-w-sm rounded-3xl p-6 text-center">
        <p className="text-lg font-bold text-white">{t('settings.restore.question')}</p>
        <p className="mt-2 text-sm text-slate-400">
          {t('settings.restore.body', { count })}
        </p>
        <div className="mt-5 flex justify-center gap-2">
          <button
            onClick={onConfirm}
            className="min-h-11 rounded-xl bg-gradient-to-r from-neon-cyan to-neon-violet px-5 py-2.5 text-sm font-semibold text-night-950 transition hover:brightness-110 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan"
          >
            {t('settings.restore.button')}
          </button>
          <button
            onClick={onCancel}
            className="min-h-11 rounded-xl border border-white/10 px-5 py-2.5 text-sm text-slate-300 transition hover:text-white active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan"
          >
            {t('common.cancel')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SettingsModal({ onClose }: Props) {
  const { allSets, sets, settings, loading, saveSettings, restoreBackup: restoreBackupData, saveSet, freeLangKey } =
    useLists();
  const t = useT();
  const [showDowngrade, setShowDowngrade] = useState(false);
  const [changingLang, setChangingLang] = useState(false);
  const { days } = usePracticeStats();
  // Stats/username live per account (guests use the shared legacy keys).
  const { user, mode } = useAuth();
  const [tab, setTab] = useState<Tab>('language');
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [pendingImport, setPendingImport] = useState<BackupData | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useDialogA11y<HTMLDivElement>(true, onClose);

  const { voices, loading: voicesLoading, hasVoice } = useSpeechVoices();
  const cloudTtsReady = useCloudTtsStatus();
  const reviewDueCount = useMemo(() => buildDueReviewQueue(sets).length, [sets]);

  // Target language for the voice pickers: the most-studied language, else en-US.
  const targetLang = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of sets) counts.set(s.lang, (counts.get(s.lang) ?? 0) + 1);
    let best = 'en-US';
    let bestCount = 0;
    for (const [lang, count] of counts) {
      if (count > bestCount) {
        best = lang;
        bestCount = count;
      }
    }
    return best;
  }, [sets]);

  const flash = useCallback((kind: 'ok' | 'err', text: string) => {
    setMsg({ kind, text });
    window.setTimeout(() => setMsg((m) => (m?.text === text ? null : m)), 4000);
  }, []);

  // Keep the SW's schedule in sync with the persisted settings (also re-arms
  // the trigger after a SW update or browser restart).
  useEffect(() => {
    if (loading) return;
    void scheduleDailyReminder(settings.reminderEnabled, settings.reminderTime, reviewDueCount);
  }, [settings.reminderEnabled, settings.reminderTime, loading, reviewDueCount]);

  const toggleReminder = useCallback(
    async (on: boolean) => {
      if (on) {
        if (typeof Notification === 'undefined') {
          flash('err', t('settings.flash.notifications.unsupported'));
          return;
        }
        const perm = await Notification.requestPermission();
        if (perm !== 'granted') {
          flash('err', t('settings.flash.permission.denied'));
          return;
        }
        saveSettings({ reminderEnabled: true });
      } else {
        saveSettings({ reminderEnabled: false });
      }
    },
    [flash, saveSettings, t],
  );

  const sendTest = useCallback(async () => {
    if (typeof Notification === 'undefined') return;
    if (Notification.permission !== 'granted') {
      void toggleReminder(true);
      return;
    }
    // In dev there is no service worker (registration is production-only), so
    // the message would go nowhere — tell the user instead of claiming success.
    if (typeof navigator === 'undefined' || !navigator.serviceWorker?.controller) {
      flash('err', t('settings.flash.reminders.need.pwa'));
      return;
    }
    const sent = await sendReminderTest(reviewDueCount);
    flash(
      sent ? 'ok' : 'err',
      sent ? t('settings.flash.test.sent') : t('settings.flash.test.failed'),
    );
  }, [toggleReminder, flash, reviewDueCount, t]);

  // ---------- data backup ----------
  const handleExport = useCallback(() => {
    // Signed-in accounts are identified by their account name; the nickname
    // only exists for guests.
    const username =
      !user && typeof window !== 'undefined'
        ? (window.localStorage.getItem(usernameStorageKey(null)) ?? undefined)
        : undefined;
    // Export the FULL library (including languages hidden by a downgrade) so a
    // backup never loses sets that will return on upgrade.
    const json = buildBackup({ settings, sets: allSets, days, username });
    downloadBackup(json, `audiorepeat-backup-${new Date().toISOString().slice(0, 10)}.json`);
    flash('ok', t('settings.flash.backup.downloaded'));
  }, [settings, allSets, days, user, flash, t]);

  const handleImportFile = useCallback(
    async (file: File) => {
      try {
        const text = await file.text();
        const parsed = parseBackup(text);
        if (!parsed) {
          flash('err', t('settings.flash.invalid.backup'));
          return;
        }
        setPendingImport(parsed);
      } catch {
        flash('err', t('settings.flash.read.failed'));
      } finally {
        if (importInputRef.current) importInputRef.current.value = '';
      }
    },
    [flash, t],
  );

  const restoreBackup = useCallback(async () => {
    if (!pendingImport) return;
    try {
      const nextSettings = { ...DEFAULT_SETTINGS, ...(pendingImport.settings ?? {}) };
      // Sets + settings commit in one IndexedDB transaction. A failed write
      // aborts without deleting the user's existing library.
      await restoreBackupData(nextSettings, pendingImport.sets ?? []);
      if (pendingImport.days) {
        window.localStorage.setItem(statsStorageKey(user?.id), JSON.stringify(pendingImport.days));
      }
      // Restored stats must REPLACE remote history on the next sync, not
      // max-merge with it (the old record is being intentionally overwritten).
      requestProgressReplace();
      if (pendingImport.username && !user) {
        window.localStorage.setItem(usernameStorageKey(null), pendingImport.username);
      }
      setPendingImport(null);
      flash('ok', t('settings.flash.restored'));
      // Reload so stats/username and the UI all settle to the restored state.
      window.setTimeout(() => window.location.reload(), 400);
    } catch {
      flash('err', t('settings.flash.restore.failed'));
    }
  }, [pendingImport, restoreBackupData, user, flash, t]);

  const clearCachedAudio = useCallback(async () => {
    let cleared = 0;
    try {
      const keys = await caches.keys();
      for (const key of keys) {
        if (key === 'tts-audio') {
          const cache = await caches.open(key);
          const reqs = await cache.keys();
          cleared = reqs.length;
          await Promise.all(reqs.map((r) => cache.delete(r)));
        }
      }
    } catch {
      flash('err', t('settings.flash.clear.cache.failed'));
      return;
    }
    flash('ok', cleared > 0 ? t('settings.flash.cache.cleared', { count: cleared }) : t('settings.flash.no.cached.audio'));
  }, [flash, t]);

  const resetProgress = useCallback(async () => {
    try {
      window.localStorage.removeItem(statsStorageKey(user?.id));
      // Mark the reset so sync drops days at/before it on both devices
      // instead of resurrecting them from the remote copy.
      if (user?.id) {
        window.localStorage.setItem(`audiorepeat-progress-reset-v1:${user.id}`, String(Date.now()));
        requestProgressReplace();
      }
      // Strip mastery marks so review/mastery state restarts cleanly.
      for (const s of sets) {
        if (s.words.some((w) => w.mastery)) {
          await saveSet({
            ...s,
            words: s.words.map((w) => ({ ...w, mastery: undefined })),
          });
        }
      }
      setConfirmReset(false);
      window.setTimeout(() => window.location.reload(), 400);
    } catch {
      flash('err', t('settings.flash.reset.failed'));
    }
  }, [sets, saveSet, user, flash, t]);

  const notificationSupported =
    typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator;

  // Rendered through a portal to document.body: several ancestors carry a
  // retained transform (e.g. the header's fade-up animation ends at
  // translateY(0)), which would otherwise become the containing block for
  // this fixed overlay and trap it inside the header's box.
  const modal = (
    <div
      ref={dialogRef}
      className="fixed inset-0 z-[100] flex items-end justify-center bg-night-950/80 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={t('settings.aria.label')}
    >
      <div className="glass animate-fade-up max-h-[92dvh] w-full max-w-xl overflow-y-auto rounded-t-3xl px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 sm:max-h-[85vh] sm:rounded-3xl sm:p-6">
        <div aria-hidden className="mx-auto mb-2 h-1 w-10 rounded-full bg-white/15 sm:hidden" />
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">{t('settings.title')}</h2>
          <button
            onClick={onClose}
            aria-label={t('settings.close.aria')}
            className="-my-2 -mr-2 flex h-11 w-11 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan"
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        {/* Horizontal scroll on phones (MN emoji tabs wrap badly when
            squeezed into flex-1 cells); wrap + equal widths from sm up. */}
        <div className="mb-5 flex gap-1.5 overflow-x-auto rounded-2xl border border-white/10 bg-night-900/60 p-1.5 sm:flex-wrap">
          {          (
            [
              { id: 'language', label: t('settings.tab.language') },
              { id: 'playback', label: t('settings.tab.playback') },
              { id: 'appearance', label: t('settings.tab.appearance') },
              { id: 'data', label: t('settings.tab.data') },
              { id: 'reminders', label: t('settings.tab.reminders') },
            ] as const
          ).map((tabItem) => (
            <button
              key={tabItem.id}
              onClick={() => setTab(tabItem.id)}
              aria-pressed={tab === tabItem.id}
              className={`flex-none whitespace-nowrap rounded-xl px-3 py-2.5 text-xs font-semibold transition active:scale-95 sm:flex-1 ${
                tab === tabItem.id
                  ? 'bg-gradient-to-r from-neon-cyan/20 to-neon-violet/20 text-white ring-1 ring-neon-cyan/40'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {tabItem.label}
            </button>
          ))}
        </div>

        {/* ---------------- Language ---------------- */}
        {tab === 'language' && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-night-900/50 p-4">
              <p className="text-sm font-semibold text-white">{t('settings.uiLang.title')}</p>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                {t('settings.uiLang.hint')}
              </p>
              <label className="mt-3 block">
                <span className="sr-only">{t('settings.uiLang.title')}</span>
                <select
                  value={settings.uiLang}
                  onChange={(e) => setUiLang(e.target.value === 'mn' ? 'mn' : 'en')}
                  className="w-full appearance-none rounded-xl border border-white/10 bg-night-800/80 px-4 py-2.5 pr-10 text-sm text-white outline-none transition focus:border-neon-cyan/60"
                >
                  {UI_LANGUAGES.map((lang) => (
                    <option key={lang.code} value={lang.code}>
                      {lang.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="rounded-2xl border border-white/10 bg-night-900/50 p-4">
              <p className="text-sm font-semibold text-white">{t('settings.translation.language.title')}</p>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                {t('settings.translation.language.hint')}
              </p>
              <label className="mt-3 block">
                <span className="sr-only">{t('settings.translation.language.title')}</span>
                <select
                  value={settings.translationLanguage}
                  onChange={(e) => saveSettings({
                    translationLanguage: e.target.value === 'mongolian' ? 'mongolian' : 'english',
                  })}
                  className="w-full appearance-none rounded-xl border border-white/10 bg-night-800/80 px-4 py-2.5 pr-10 text-sm text-white outline-none transition focus:border-neon-cyan/60"
                >
                  <option value="english">{t('settings.translation.language.english')}</option>
                  <option value="mongolian">{t('settings.translation.language.mongolian')}</option>
                </select>
              </label>
            </div>

            <div className="rounded-2xl border border-white/10 bg-night-900/50 p-4">
              <p className="text-sm font-semibold text-white">{t('settings.practice.lang')}</p>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                {isProPlan(settings.plan)
                  ? t('settings.pro.lang.line', { count: SUPPORTED_LANGUAGE_COUNT })
                  : t('settings.free.lang.line', { limit: FREE_LANG_LIMIT, count: SUPPORTED_LANGUAGE_COUNT })}
              </p>

              {isProPlan(settings.plan) ? (
                <div className="mt-3">
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-slate-500">
                      {t('settings.default.new.set.lang')}
                    </span>
                    <select
                      value={settings.defaultNewSetLang ?? ''}
                      onChange={(e) => {
                        saveSettings({ defaultNewSetLang: e.target.value || null });
                      }}
                      className="w-full appearance-none rounded-xl border border-white/10 bg-night-800/80 px-4 py-2.5 pr-10 text-sm text-white outline-none transition focus:border-neon-cyan/60"
                    >
                      <option value="">{t('settings.auto.set.lang')}</option>
                      {FREE_LANG_OPTIONS.map((o) => (
                        <option key={o.code} value={o.code}>
                          {o.label}{o.hasFullPack ? t('settings.full.pack.suffix') : ''}
                        </option>
                      ))}
                    </select>
                  </label>
                  <p className="mt-1.5 text-[11px] text-slate-500">
                    {t('settings.default.set.lang.hint')}
                  </p>
                </div>
              ) : (
                <div className="mt-3 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-white">
                      {FREE_LANG_OPTIONS.find((o) => o.key === settings.selectedFreeLang)?.label ??
                        findLanguage(settings.selectedFreeLang ?? '')?.label ??
                        settings.selectedFreeLang ??
                        t('settings.not.selected.yet')}
                    </span>
                    <span className="rounded-full border border-neon-cyan/40 bg-neon-cyan/10 px-2 py-0.5 text-[10px] font-semibold text-neon-cyan">
                      {t('settings.current')}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setChangingLang(true)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-300 transition hover:border-neon-cyan/40 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan"
                    >
                      {t('settings.change.language')}
                    </button>
                    <Link
                      href="/checkout?plan=pro"
                      className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-300 transition hover:border-neon-cyan/40 hover:text-white"
                    >
                      {t('settings.upgrade.all.languages', { count: SUPPORTED_LANGUAGE_COUNT })}
                    </Link>
                  </div>
                  <p className="text-[11px] leading-relaxed text-slate-500">
                    {t('settings.switching.hint')}
                  </p>
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-white/10 bg-night-900/50 p-4">
              <p className="text-sm font-semibold text-white">{t('settings.voice.availability')}</p>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                {t('settings.voice.availability.body')}
              </p>
              {cloudTtsReady ? (
                planHasFeature(settings.plan, 'offlineAudio') ? (
                  <div className="mt-3 rounded-xl border border-neon-cyan/20 bg-neon-cyan/5 p-3">
                    <Toggle
                      checked={settings.cloudTts}
                      onChange={(cloudTts) => saveSettings({ cloudTts })}
                      label={t('settings.cloud.voices.toggle')}
                      hint={t('settings.cloud.voices.hint')}
                    />
                  </div>
                ) : (
                  <div className="mt-3 rounded-xl border border-neon-amber/25 bg-neon-amber/5 p-3">
                    <p className="text-sm font-semibold text-white">
                      {t('settings.pro.cloud.title')}
                    </p>
                    <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
                      {t('settings.pro.cloud.body')}
                    </p>
                    <Link
                      href="/checkout?plan=pro"
                      className="mt-2 inline-flex items-center gap-1.5 rounded-xl bg-neon-amber px-3.5 py-2 text-xs font-bold text-night-950 transition hover:brightness-110"
                    >
                      {t('settings.upgrade.to.pro')}
                    </Link>
                  </div>
                )
              ) : (
                <p className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-[11px] text-slate-500">
                  {t('settings.cloud.not.configured')}
                </p>
              )}
              {voicesLoading ? (
                <p className="mt-2 text-[11px] text-slate-400">{t('settings.loading.voices')}</p>
              ) : (
                <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                  {FREE_LANG_OPTIONS.map((o) => {
                    const has = hasVoice(o.code);
                    const cloud = !has && cloudTtsReady;
                    return (
                      <div
                        key={o.key}
                        className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] ${
                          has
                            ? 'border-neon-green/30 bg-neon-green/5 text-neon-green'
                            : cloud
                              ? 'border-neon-cyan/25 bg-neon-cyan/5 text-neon-cyan'
                            : 'border-white/10 bg-night-800/40 text-slate-500'
                        }`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${has ? 'bg-neon-green' : cloud ? 'bg-neon-cyan' : 'bg-slate-600'}`} />
                        <span className="truncate">{o.label.split('(')[0].trim()}</span>
                      </div>
                    );
                  })}
                </div>
              )}
              <p className="mt-2 text-[11px] text-slate-500">
                {t('settings.voice.legend')}
                {!cloudTtsReady && t('settings.voice.legend.gray')}
              </p>
            </div>
          </div>
        )}

        {msg && (
          <div
            role={msg.kind === 'err' ? 'alert' : 'status'}
            className={`animate-fade-up mb-4 flex items-start gap-2 rounded-xl border px-4 py-2.5 text-sm ${
              msg.kind === 'ok'
                ? 'border-neon-green/40 bg-neon-green/10 text-neon-green'
                : 'border-neon-magenta/40 bg-neon-magenta/10 text-neon-magenta'
            }`}
          >
            <span aria-hidden>{msg.kind === 'ok' ? '✓' : '⚠'}</span>
            <span>{msg.text}</span>
          </div>
        )}


        {tab === 'playback' && (
          <div className="space-y-5">
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-500">
                {t('settings.repeat.each.word')}
              </p>
              <div className="flex gap-1.5">
                {REPEAT_OPTIONS.map((r) => (
                  <button
                    key={r}
                    onClick={() => saveSettings({ repeats: r })}
                    className={`flex-1 rounded-xl py-2 text-sm font-semibold transition active:scale-95 ${
                      settings.repeats === r
                        ? 'bg-neon-cyan text-night-950'
                        : 'bg-night-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {r}×
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-[11px] text-slate-500">
                {t('settings.repeat.hint')}
              </p>
            </div>

            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-500">
                {t('settings.default.speed')}
              </p>
              <div className="flex gap-1.5">
                {SPEED_OPTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => saveSettings({ speed: s })}
                    className={`flex-1 rounded-xl py-2 text-sm font-semibold transition active:scale-95 ${
                      Math.abs(settings.speed - s) < 0.001
                        ? 'bg-neon-cyan text-night-950'
                        : 'bg-night-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {s}×
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-[11px] text-slate-500">
                {t('settings.speed.hint')}
              </p>
            </div>

            <div>
              <p className="mb-2 flex items-center justify-between text-xs font-medium uppercase tracking-wider text-slate-500">
                <span>{t('settings.pause.before.translation')}</span>
                <span className="rounded-md bg-night-800 px-2 py-0.5 font-mono text-neon-cyan">
                  {(settings.targetGapMs / 1000).toFixed(1)}s
                </span>
              </p>
              <input
                type="range"
                min={1000}
                max={5000}
                step={100}
                value={settings.targetGapMs}
                onChange={(e) => saveSettings({ targetGapMs: Number(e.target.value) })}
                className="w-full accent-neon-cyan"
              />
              <div className="flex justify-between text-[11px] text-slate-600">
                <span>1s</span>
                <span>5s</span>
              </div>
            </div>

            <div className="space-y-4 border-t border-white/10 pt-4">
              <VoicePicker
                label={t('settings.target.voice.label', { lang: targetLang })}
                lang={targetLang}
                value={settings.targetVoiceURI}
                voices={voices}
                loading={voicesLoading}
                onChange={(uri) => saveSettings({ targetVoiceURI: uri })}
              />
              <VoicePicker
                label={t('settings.translation.voice.label')}
                lang="en-US"
                value={settings.translationVoiceURI}
                voices={voices}
                loading={voicesLoading}
                onChange={(uri) => saveSettings({ translationVoiceURI: uri })}
              />
              <p className="text-[11px] text-slate-500">
                {t('settings.voices.override.hint')}
              </p>
            </div>
          </div>
        )}

        {/* ---------------- Appearance ---------------- */}
        {tab === 'appearance' && (
          <div className="space-y-5">
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-500">
                {t('settings.theme')}
              </p>
              <div className="grid gap-2 sm:grid-cols-3">
                {THEMES.map((theme) => (
                  <button
                    key={theme.id}
                    onClick={() => saveSettings({ theme: theme.id })}
                    aria-pressed={settings.theme === theme.id}
                    className={`rounded-2xl border p-3 text-left transition active:scale-95 ${
                      settings.theme === theme.id
                        ? 'border-neon-cyan/60 bg-neon-cyan/10 ring-1 ring-neon-cyan/50'
                        : 'border-white/10 bg-night-800/60 hover:border-white/25'
                    }`}
                  >
                    <span className="flex gap-1.5">
                      {theme.swatches.map((c) => (
                        <span
                          key={c}
                          className="h-6 w-6 rounded-full border border-white/20"
                          style={{ background: c }}
                        />
                      ))}
                    </span>
                    <span className="mt-2 block text-sm font-semibold text-white">
                      {t(THEME_LABEL_KEYS[theme.id])}
                    </span>
                    <span className="mt-0.5 block text-[11px] leading-snug text-slate-400">
                      {t(THEME_DESC_KEYS[theme.id])}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4 border-t border-white/10 pt-4">
              <Toggle
                checked={settings.showHints}
                onChange={(v) => saveSettings({ showHints: v })}
                label={t('settings.hints.toggle')}
                hint={t('settings.hints.hint')}
              />
              <Toggle
                checked={settings.showExamples}
                onChange={(v) => saveSettings({ showExamples: v })}
                label={t('settings.examples.toggle')}
                hint={t('settings.examples.hint')}
              />
              <p className="text-sm text-slate-400">
                {cloudTtsReady
                  ? planHasFeature(settings.plan, 'offlineAudio')
                    ? settings.cloudTts
                      ? t('settings.cloud.speech.on')
                      : t('settings.cloud.speech.available.off')
                    : t('settings.cloud.speech.pro.only')
                  : t('settings.cloud.speech.unconfigured')}
              </p>
            </div>
          </div>
        )}

        {/* ---------------- Data ---------------- */}
        {tab === 'data' && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-night-900/50 p-4">
              <p className="text-sm font-semibold text-white">{t('settings.account')}</p>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                {user
                  ? t('settings.account.signed.in', {
                      who: user.email ?? `@${user.username}`,
                    })
                  : mode === 'firebase'
                    ? t('settings.account.guest')
                    : t('settings.account.unconfigured')}
              </p>
              <p className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-400">
                <span
                  className={`rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                    isProPlan(settings.plan)
                      ? 'border-neon-amber/40 bg-neon-amber/15 text-neon-amber'
                      : 'border-white/10 text-slate-400'
                  }`}
                >
                  {isProPlan(settings.plan) ? '★ ' : ''}
                  {PLAN_BADGE[settings.plan].short}
                </span>
                <span>{planDetail(settings.plan, settings.planBilling, settings.planSource)}</span>
                <Link
                  href={isProPlan(settings.plan) ? '/checkout' : '/checkout?plan=pro'}
                  className="font-semibold text-neon-cyan transition hover:text-neon-amber"
                >
                  {isProPlan(settings.plan) ? t('settings.view.plans') : t('settings.upgrade')}
                </Link>
                {isProPlan(settings.plan) && (
                  <button
                    onClick={() => setShowDowngrade(true)}
                    className="font-semibold text-slate-400 underline decoration-slate-600 underline-offset-2 transition hover:text-neon-amber hover:decoration-neon-amber/50"
                  >
                    {t('settings.switch.to.free')}
                  </button>
                )}
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-night-900/50 p-4">
              <p className="text-sm font-semibold text-white">{t('settings.backup.title')}</p>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                {t('settings.backup.body')}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  onClick={handleExport}
                  className="rounded-xl bg-gradient-to-r from-neon-cyan to-neon-violet px-4 py-2 text-sm font-semibold text-night-950 transition hover:brightness-110 active:scale-95"
                >
                  {t('settings.export.backup')}
                </button>
                <input
                  ref={importInputRef}
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handleImportFile(file);
                  }}
                />
                <button
                  onClick={() => importInputRef.current?.click()}
                  className="rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-300 transition hover:border-white/25 hover:text-white active:scale-95"
                >
                  {t('settings.import.backup')}
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-night-900/50 p-4">
              <p className="text-sm font-semibold text-white">{t('settings.cache.title')}</p>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                {t('settings.cache.body')}
              </p>
              <button
                onClick={() => void clearCachedAudio()}
                className="mt-3 rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-300 transition hover:border-neon-amber/40 hover:text-neon-amber active:scale-95"
              >
                {t('settings.clear.cached.audio')}
              </button>
            </div>

            <div className="rounded-2xl border border-neon-magenta/20 bg-neon-magenta/5 p-4">
              <p className="text-sm font-semibold text-white">{t('settings.reset.progress.title')}</p>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                {t('settings.reset.progress.body')}
              </p>
              {confirmReset ? (
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => void resetProgress()}
                    className="rounded-xl bg-neon-magenta px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110 active:scale-95"
                  >
                    {t('settings.reset.progress.confirm')}
                  </button>
                  <button
                    onClick={() => setConfirmReset(false)}
                    className="rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-300 transition hover:text-white active:scale-95"
                  >
                    {t('common.cancel')}
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmReset(true)}
                  className="mt-3 rounded-xl border border-neon-magenta/40 px-4 py-2 text-sm text-neon-magenta transition hover:bg-neon-magenta/10 active:scale-95"
                >
                  {t('settings.reset.progress.button')}
                </button>
              )}
            </div>
          </div>
        )}

        {/* ---------------- Reminders ---------------- */}
        {tab === 'reminders' && (
          <div className="space-y-4">
            {!notificationSupported ? (
              <div className="rounded-2xl border border-neon-amber/30 bg-neon-amber/10 p-4 text-sm text-neon-amber">
                {t('settings.reminders.unsupported.body')}
              </div>
            ) : (
              <>
                <div className="rounded-2xl border border-white/10 bg-night-900/50 p-4">
                  <Toggle
                    checked={settings.reminderEnabled}
                    onChange={(v) => void toggleReminder(v)}
                    label={t('settings.daily.reminder.toggle')}
                    hint={t('settings.daily.reminder.hint')}
                  />
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <label className="block">
                      <span className="mb-1 block text-xs font-medium uppercase tracking-wider text-slate-500">
                        {t('settings.remind.me.at')}
                      </span>
                      <input
                        type="time"
                        value={settings.reminderTime}
                        onChange={(e) => saveSettings({ reminderTime: e.target.value })}
                        className={inputClass}
                      />
                    </label>
                    <button
                      onClick={sendTest}
                      disabled={!settings.reminderEnabled}
                      className="mt-5 rounded-xl border border-white/10 px-4 py-2.5 text-sm text-slate-300 transition hover:border-neon-cyan/40 hover:text-white active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {t('settings.send.test.notification')}
                    </button>
                  </div>
                  <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
                    {t('settings.reminders.triggers.hint')}
                  </p>
                </div>

                {typeof Notification !== 'undefined' &&
                  Notification.permission === 'denied' && (
                    <p className="text-[11px] text-neon-magenta">
                      {t('settings.reminders.blocked.note')}
                    </p>
                  )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Downgrade flow (z-120 keeps it above this modal's z-100 portal) */}
      {showDowngrade && <DowngradeModal onClose={() => setShowDowngrade(false)} />}

      {/* Free-language switcher — the same entitlement-safe flow the
          dashboard uses (seeds idempotently, hides instead of deleting). */}
      {changingLang && (
        <ChangeFreeLanguageModal
          currentKey={freeLangKey}
          allSets={allSets}
          saveSet={saveSet}
          onClose={() => setChangingLang(false)}
        />
      )}

      {/* Restore-confirmation overlay (kept above the modal content) */}
      {pendingImport && (
        <RestoreConfirmOverlay
          t={t}
          count={pendingImport.sets?.length ?? 0}
          onConfirm={() => void restoreBackup()}
          onCancel={() => setPendingImport(null)}
        />
      )}
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modal, document.body) : null;
}
