'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLists } from '@/hooks/useLists';
import { useAuth } from '@/hooks/useAuth';
import { usePracticeStats } from '@/hooks/usePracticeStats';
import { useSpeechVoices } from '@/hooks/useSpeechVoices';
import DowngradeModal from '@/components/checkout/DowngradeModal';
import { buildBackup, downloadBackup, parseBackup, type BackupData } from '@/lib/sets/backup';
import { statsStorageKey, usernameStorageKey } from '@/lib/auth/scopes';
import { isProPlan, PLAN_BADGE, planDetail } from '@/lib/plans';
import type { ThemeName } from '@/types/app';
import { DEFAULT_SETTINGS } from '@/types/app';
import VoicePicker from '@/components/player/VoicePicker';

const REPEAT_OPTIONS = [1, 2, 3, 5];
const SPEED_OPTIONS = [0.75, 1, 1.25, 1.5, 2];

const THEMES: { id: ThemeName; label: string; desc: string; swatches: string[] }[] = [
  {
    id: 'neon',
    label: 'Dark Glass',
    desc: 'Deep charcoal mesh with blue accents',
    swatches: ['#0b0c10', '#3b82f6', '#38bdf8'],
  },
  {
    id: 'dark',
    label: 'Dark Mode',
    desc: 'Muted charcoal, calmer standard accents',
    swatches: ['#0b0c10', '#38bdf8', '#0ea5e9'],
  },
  {
    id: 'light',
    label: 'Minimal Light',
    desc: 'Light surfaces with dark slate text',
    swatches: ['#f6f7fb', '#0891b2', '#2563eb'],
  },
];

type Tab = 'playback' | 'appearance' | 'data' | 'reminders';

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
    <button onClick={() => onChange(!checked)} className="flex w-full items-center gap-3 text-left">
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

export default function SettingsModal({ onClose }: Props) {
  const { allSets, sets, settings, loading, saveSettings, replaceSettings, clearSets, saveSet } =
    useLists();
  const [showDowngrade, setShowDowngrade] = useState(false);
  const { days } = usePracticeStats();
  // Stats/username live per account (guests use the shared legacy keys).
  const { user, mode } = useAuth();
  const [tab, setTab] = useState<Tab>('playback');
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [pendingImport, setPendingImport] = useState<BackupData | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  const { voices, loading: voicesLoading } = useSpeechVoices();

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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // ---------- daily reminder (service worker + Notification Triggers) ----------
  const postToSW = useCallback((data: unknown) => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.ready
      .then((reg) => reg.active?.postMessage(data))
      .catch(() => {
        /* no SW (dev mode) — ignore */
      });
  }, []);

  const scheduleReminder = useCallback(
    (enabled: boolean, time: string) => {
      if (!enabled || !/^\d{2}:\d{2}$/.test(time)) {
        postToSW({ type: 'CLEAR_REMINDER' });
        return;
      }
      const [h, m] = time.split(':').map(Number);
      const next = new Date();
      next.setHours(h, m, 0, 0);
      if (next.getTime() <= Date.now()) next.setDate(next.getDate() + 1);
      postToSW({
        type: 'SET_REMINDER',
        timestamp: next.getTime(),
        title: 'Time to practice! 🔁',
        body: 'Keep your streak alive — a quick AudioRepeat session is waiting.',
      });
    },
    [postToSW],
  );

  // Keep the SW's schedule in sync with the persisted settings (also re-arms
  // the trigger after a SW update or browser restart).
  useEffect(() => {
    if (loading) return;
    scheduleReminder(settings.reminderEnabled, settings.reminderTime);
  }, [settings.reminderEnabled, settings.reminderTime, loading, scheduleReminder]);

  const toggleReminder = useCallback(
    async (on: boolean) => {
      if (on) {
        if (typeof Notification === 'undefined') {
          flash('err', 'Notifications are not supported in this browser.');
          return;
        }
        const perm = await Notification.requestPermission();
        if (perm !== 'granted') {
          flash('err', 'Permission denied — enable notifications in your browser settings.');
          return;
        }
        saveSettings({ reminderEnabled: true });
      } else {
        saveSettings({ reminderEnabled: false });
      }
    },
    [flash, saveSettings],
  );

  const sendTest = useCallback(() => {
    if (typeof Notification === 'undefined') return;
    if (Notification.permission !== 'granted') {
      void toggleReminder(true);
      return;
    }
    // In dev there is no service worker (registration is production-only), so
    // the message would go nowhere — tell the user instead of claiming success.
    if (typeof navigator === 'undefined' || !navigator.serviceWorker?.controller) {
      flash('err', 'Reminders need the installed PWA (production build) — not available in dev.');
      return;
    }
    // Fire ~1s from now — the SW shows it via a trigger (or immediately).
    postToSW({
      type: 'SET_REMINDER',
      timestamp: Date.now() + 1000,
      title: 'AudioRepeat reminder 🔁',
      body: 'If you see this, daily reminders are armed and working.',
      tag: 'reminder-test',
    });
    flash('ok', 'Test notification sent (check your notification center).');
  }, [postToSW, toggleReminder, flash]);

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
    flash('ok', 'Backup downloaded — keep it somewhere safe.');
  }, [settings, allSets, days, user, flash]);

  const handleImportFile = useCallback(
    async (file: File) => {
      try {
        const text = await file.text();
        const parsed = parseBackup(text);
        if (!parsed) {
          flash('err', 'That file is not a valid AudioRepeat backup.');
          return;
        }
        setPendingImport(parsed);
      } catch {
        flash('err', 'Could not read that backup file.');
      } finally {
        if (importInputRef.current) importInputRef.current.value = '';
      }
    },
    [flash],
  );

  const restoreBackup = useCallback(async () => {
    if (!pendingImport) return;
    try {
      if (pendingImport.settings) {
        replaceSettings({ ...DEFAULT_SETTINGS, ...pendingImport.settings });
      }
      await clearSets();
      // saveSet (not raw putSet) keeps in-memory state consistent with the DB
      // even if the reload below is blocked.
      for (const s of pendingImport.sets ?? []) await saveSet(s);
      if (pendingImport.days) {
        window.localStorage.setItem(statsStorageKey(user?.id), JSON.stringify(pendingImport.days));
      }
      if (pendingImport.username && !user) {
        window.localStorage.setItem(usernameStorageKey(null), pendingImport.username);
      }
      setPendingImport(null);
      flash('ok', 'Backup restored — reloading…');
      // Reload so stats/username and the UI all settle to the restored state.
      window.setTimeout(() => window.location.reload(), 400);
    } catch {
      flash('err', 'Restore failed — reload the app and check your data.');
    }
  }, [pendingImport, replaceSettings, clearSets, saveSet, user, flash]);

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
      flash('err', 'Could not clear the audio cache.');
      return;
    }
    flash('ok', cleared > 0 ? `Cleared ${cleared} cached audio clip(s).` : 'No cached audio found.');
  }, [flash]);

  const resetProgress = useCallback(async () => {
    try {
      window.localStorage.removeItem(statsStorageKey(user?.id));
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
      flash('err', 'Reset failed.');
    }
  }, [sets, saveSet, user, flash]);

  const notificationSupported =
    typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator;

  // Rendered through a portal to document.body: several ancestors carry a
  // retained transform (e.g. the header's fade-up animation ends at
  // translateY(0)), which would otherwise become the containing block for
  // this fixed overlay and trap it inside the header's box.
  const modal = (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-night-950/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Settings"
    >
      <div className="glass animate-fade-up max-h-[85vh] w-full max-w-xl overflow-y-auto rounded-3xl p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">⚙️ Settings</h2>
          <button
            onClick={onClose}
            aria-label="Close settings"
            className="rounded-lg px-2 py-1 text-slate-400 transition hover:bg-white/5 hover:text-white"
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="mb-5 flex flex-wrap gap-1.5 rounded-2xl border border-white/10 bg-night-900/60 p-1.5">
          {(
            [
              { id: 'playback', label: '🎛️ Playback' },
              { id: 'appearance', label: '🎨 Appearance' },
              { id: 'data', label: '💾 Data' },
              { id: 'reminders', label: '🔔 Reminders' },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              aria-pressed={tab === t.id}
              className={`flex-1 rounded-xl px-3 py-2 text-xs font-semibold transition active:scale-95 ${
                tab === t.id
                  ? 'bg-gradient-to-r from-neon-cyan/20 to-neon-violet/20 text-white ring-1 ring-neon-cyan/40'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {msg && (
          <div
            className={`animate-fade-up mb-4 rounded-xl border px-4 py-2.5 text-sm ${
              msg.kind === 'ok'
                ? 'border-neon-green/40 bg-neon-green/10 text-neon-green'
                : 'border-neon-magenta/40 bg-neon-magenta/10 text-neon-magenta'
            }`}
          >
            {msg.text}
          </div>
        )}

        {/* ---------------- Playback ---------------- */}
        {tab === 'playback' && (
          <div className="space-y-5">
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-500">
                Repeat each word
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
                The translation is always spoken once after the repeats.
              </p>
            </div>

            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-500">
                Default playback speed
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
                The player bar also offers a fine-grained 0.5×–2× slider for the current session.
              </p>
            </div>

            <div>
              <p className="mb-2 flex items-center justify-between text-xs font-medium uppercase tracking-wider text-slate-500">
                <span>Pause before translation</span>
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
                label={`Default target voice (${targetLang})`}
                lang={targetLang}
                value={settings.targetVoiceURI}
                voices={voices}
                loading={voicesLoading}
                onChange={(uri) => saveSettings({ targetVoiceURI: uri })}
              />
              <VoicePicker
                label="Default translation voice"
                lang="en-US"
                value={settings.translationVoiceURI}
                voices={voices}
                loading={voicesLoading}
                onChange={(uri) => saveSettings({ translationVoiceURI: uri })}
              />
              <p className="text-[11px] text-slate-500">
                Voices apply to every set unless a set has its own overrides (Loop settings →{' '}
                “Customize settings for this set”).
              </p>
            </div>
          </div>
        )}

        {/* ---------------- Appearance ---------------- */}
        {tab === 'appearance' && (
          <div className="space-y-5">
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-500">
                Theme
              </p>
              <div className="grid gap-2 sm:grid-cols-3">
                {THEMES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => saveSettings({ theme: t.id })}
                    aria-pressed={settings.theme === t.id}
                    className={`rounded-2xl border p-3 text-left transition active:scale-95 ${
                      settings.theme === t.id
                        ? 'border-neon-cyan/60 bg-neon-cyan/10 ring-1 ring-neon-cyan/50'
                        : 'border-white/10 bg-night-800/60 hover:border-white/25'
                    }`}
                  >
                    <span className="flex gap-1.5">
                      {t.swatches.map((c) => (
                        <span
                          key={c}
                          className="h-6 w-6 rounded-full border border-white/20"
                          style={{ background: c }}
                        />
                      ))}
                    </span>
                    <span className="mt-2 block text-sm font-semibold text-white">{t.label}</span>
                    <span className="mt-0.5 block text-[11px] leading-snug text-slate-400">
                      {t.desc}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4 border-t border-white/10 pt-4">
              <Toggle
                checked={settings.showHints}
                onChange={(v) => saveSettings({ showHints: v })}
                label="Emoji & visual hints on word cards"
                hint="A contextual emoji for each word — works offline"
              />
              <Toggle
                checked={settings.showExamples}
                onChange={(v) => saveSettings({ showExamples: v })}
                label="Example sentences"
                hint="Show a word's example sentence when it has one"
              />
              {isProPlan(settings.plan) ? (
                <Toggle
                  checked={settings.cachedAudio}
                  onChange={(v) => saveSettings({ cachedAudio: v })}
                  label="Prefer cached audio (offline playback)"
                  hint="Uses pre-generated audio when available instead of live TTS"
                />
              ) : (
                <a
                  href="/checkout?plan=pro"
                  className="flex w-full items-center gap-3 text-left"
                  title="Offline audio packs are a Pro feature"
                >
                  <span className="flex h-6 w-11 shrink-0 items-center justify-center rounded-full bg-night-600">
                    <svg
                      viewBox="0 0 24 24"
                      className="h-3.5 w-3.5 text-slate-500"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden
                    >
                      <rect x="4" y="11" width="16" height="10" rx="2" />
                      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                    </svg>
                  </span>
                  <span>
                    <span className="block text-sm text-slate-300">
                      Prefer cached audio (offline playback)
                    </span>
                    <span className="block text-[11px] text-neon-amber">
                      ⭐ Pro feature — tap to upgrade
                    </span>
                  </span>
                </a>
              )}
            </div>
          </div>
        )}

        {/* ---------------- Data ---------------- */}
        {tab === 'data' && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-night-900/50 p-4">
              <p className="text-sm font-semibold text-white">Account</p>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                {user
                  ? `Signed in with Firebase as ${user.email ?? `@${user.username}`}. Your identity syncs online; stats, streak and sets stay on this device.`
                  : mode === 'firebase'
                    ? 'You are using the app as a guest. Sign in with Google or an email account from the header.'
                    : "Firebase isn't configured yet — add your config to .env.local (see .env.example) to enable sign-in. Until then, the app runs in guest mode."}
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
                  {isProPlan(settings.plan) ? 'View plans' : 'Upgrade'}
                </Link>
                {isProPlan(settings.plan) && (
                  <button
                    onClick={() => setShowDowngrade(true)}
                    className="font-semibold text-slate-400 underline decoration-slate-600 underline-offset-2 transition hover:text-neon-amber hover:decoration-neon-amber/50"
                  >
                    Switch to Free
                  </button>
                )}
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-night-900/50 p-4">
              <p className="text-sm font-semibold text-white">Backup & restore</p>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                Export your sets, settings, stats and display name as a single JSON file, and
                restore them on any device.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  onClick={handleExport}
                  className="rounded-xl bg-gradient-to-r from-neon-cyan to-neon-violet px-4 py-2 text-sm font-semibold text-night-950 transition hover:brightness-110 active:scale-95"
                >
                  ⬇ Export backup
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
                  ⬆ Import backup
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-night-900/50 p-4">
              <p className="text-sm font-semibold text-white">Cache</p>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                Pre-generated speech clips are stored in the browser cache so they play offline.
                Clearing them frees space; clips regenerate on demand.
              </p>
              <button
                onClick={() => void clearCachedAudio()}
                className="mt-3 rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-300 transition hover:border-neon-amber/40 hover:text-neon-amber active:scale-95"
              >
                🗑 Clear cached audio
              </button>
            </div>

            <div className="rounded-2xl border border-neon-magenta/20 bg-neon-magenta/5 p-4">
              <p className="text-sm font-semibold text-white">Reset study progress</p>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                Clears your streak, daily stats and word-mastery marks. Your sets are kept.
              </p>
              {confirmReset ? (
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => void resetProgress()}
                    className="rounded-xl bg-neon-magenta px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110 active:scale-95"
                  >
                    Yes, reset everything
                  </button>
                  <button
                    onClick={() => setConfirmReset(false)}
                    className="rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-300 transition hover:text-white active:scale-95"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmReset(true)}
                  className="mt-3 rounded-xl border border-neon-magenta/40 px-4 py-2 text-sm text-neon-magenta transition hover:bg-neon-magenta/10 active:scale-95"
                >
                  Reset progress…
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
                Daily reminders need the Service Worker + Notification API. They work when the app
                is installed as a PWA (production build) — not in the dev preview.
              </div>
            ) : (
              <>
                <div className="rounded-2xl border border-white/10 bg-night-900/50 p-4">
                  <Toggle
                    checked={settings.reminderEnabled}
                    onChange={(v) => void toggleReminder(v)}
                    label="Daily practice reminder"
                    hint="A notification reminds you to practice at the chosen time"
                  />
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <label className="block">
                      <span className="mb-1 block text-xs font-medium uppercase tracking-wider text-slate-500">
                        Remind me at
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
                      Send test notification
                    </button>
                  </div>
                  <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
                    Uses the browser’s Notification Triggers API, so the reminder fires even when
                    the app is closed (Chrome desktop & Android). The reminder re-arms whenever you
                    open the app.
                  </p>
                </div>

                {typeof Notification !== 'undefined' &&
                  Notification.permission === 'denied' && (
                    <p className="text-[11px] text-neon-magenta">
                      Notifications are blocked in your browser settings. Unblock them to enable
                      reminders.
                    </p>
                  )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Downgrade flow (z-120 keeps it above this modal's z-100 portal) */}
      {showDowngrade && <DowngradeModal onClose={() => setShowDowngrade(false)} />}

      {/* Restore-confirmation overlay (kept above the modal content) */}
      {pendingImport && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
        >
          <div className="glass animate-fade-up w-full max-w-sm rounded-3xl p-6 text-center">
            <p className="text-lg font-bold text-white">Restore backup?</p>
            <p className="mt-2 text-sm text-slate-400">
              This replaces your current library, settings, stats and display name with the backup
              ({pendingImport.sets?.length ?? 0} sets).
            </p>
            <div className="mt-5 flex justify-center gap-2">
              <button
                onClick={() => void restoreBackup()}
                className="rounded-xl bg-gradient-to-r from-neon-cyan to-neon-violet px-5 py-2.5 text-sm font-semibold text-night-950 transition hover:brightness-110 active:scale-95"
              >
                Restore
              </button>
              <button
                onClick={() => setPendingImport(null)}
                className="rounded-xl border border-white/10 px-5 py-2.5 text-sm text-slate-300 transition hover:text-white active:scale-95"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modal, document.body) : null;
}
