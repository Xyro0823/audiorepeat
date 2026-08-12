'use client';

import { useState } from 'react';
import { formatCountdown } from '@/lib/format';
import type { AppSettings } from '@/types/app';
import type { TTSEngineVoice } from '@/lib/tts/engine';
import VoicePicker from './VoicePicker';

const REPEAT_OPTIONS = [1, 2, 3, 5];

interface Props {
  settings: AppSettings;
  onChange: (patch: Partial<AppSettings>) => void;
  customMode: boolean; // editing per-set overrides vs the global settings
  onToggleCustom: (on: boolean) => void;
  /** Selected sleep-timer duration in minutes, or null when off (transient, not persisted). */
  sleepMinutes: number | null;
  /** Milliseconds left on the active timer, or null when off. */
  sleepRemaining: number | null;
  onSleepChange: (minutes: number | null) => void;
  voices: TTSEngineVoice[];
  voicesLoading: boolean;
  targetLang: string;
  nativeLang: string;
  /** Pre-warm progress (cloud TTS caching), or null when idle. Purely informational. */
  prewarm?: { done: number; total: number } | null;
  /** Brief post-warm-up summary, or null. Auto-dismissed by the caller. */
  prewarmSummary?: string | null;
}

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
    <button onClick={() => onChange(!checked)} className="flex items-center gap-3 text-left">
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

const SLEEP_PRESETS = [15, 30, 45, 60];

export default function SettingsPanel({
  settings,
  onChange,
  customMode,
  onToggleCustom,
  sleepMinutes,
  sleepRemaining,
  onSleepChange,
  voices,
  voicesLoading,
  targetLang,
  nativeLang,
  prewarm = null,
  prewarmSummary = null,
}: Props) {
  const [open, setOpen] = useState(false);
  const [customMin, setCustomMin] = useState('');

  return (
    <section className="animate-fade-up mb-6">
      <div className="flex flex-wrap items-center justify-center gap-2">
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-300 transition hover:border-neon-cyan/40 hover:text-white"
        >
          <svg
            viewBox="0 0 24 24"
            className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
          Loop settings
          {customMode && (
            <span className="rounded-full bg-neon-magenta/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-neon-magenta">
              this set
            </span>
          )}
        </button>
        {prewarm && (
          <span
            role="status"
            aria-live="polite"
            title={`Caching audio for offline / lock-screen playback — ${prewarm.done} of ${prewarm.total} done`}
            className="flex items-center gap-1.5 rounded-full border border-neon-cyan/30 bg-neon-cyan/10 px-3 py-1.5 text-[11px] font-medium text-neon-cyan"
          >
            <span className="h-3 w-3 animate-spin rounded-full border border-neon-cyan/30 border-t-neon-cyan" />
            Caching audio… {prewarm.done}/{prewarm.total}
          </span>
        )}
        {prewarmSummary && (
          <span
            role="status"
            aria-live="polite"
            className="flex items-center gap-1.5 rounded-full border border-neon-amber/40 bg-neon-amber/10 px-3 py-1.5 text-[11px] font-medium text-neon-amber"
          >
            {prewarmSummary}
          </span>
        )}
      </div>

      {open && (
        <div className="glass animate-fade-up mt-4 grid gap-6 rounded-2xl p-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Toggle
              checked={customMode}
              onChange={onToggleCustom}
              label="Customize settings for this set"
              hint={
                customMode
                  ? 'Changes below apply only to this set'
                  : 'Changes below apply to all sets'
              }
            />
          </div>

          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-500">
              Repeats per word
            </p>
            <div className="flex gap-1.5">
              {REPEAT_OPTIONS.map((r) => (
                <button
                  key={r}
                  onClick={() => onChange({ repeats: r })}
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
            <p className="mt-2 text-[11px] text-slate-500">
              The translation is always spoken once after the repeats.
            </p>
          </div>

          <div>
            <p className="mb-2 flex items-center justify-between text-xs font-medium uppercase tracking-wider text-slate-500">
              <span>Speed</span>
              <span className="rounded-md bg-night-800 px-2 py-0.5 font-mono text-neon-cyan">
                {settings.speed.toFixed(1)}×
              </span>
            </p>
            <input
              type="range"
              min={0.5}
              max={2}
              step={0.1}
              value={settings.speed}
              onChange={(e) => onChange({ speed: Number(e.target.value) })}
              className="w-full accent-neon-cyan"
            />
            <div className="flex justify-between text-[11px] text-slate-600">
              <span>0.5×</span>
              <span>2×</span>
            </div>
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
              onChange={(e) => onChange({ targetGapMs: Number(e.target.value) })}
              className="w-full accent-neon-cyan"
            />
            <div className="flex justify-between text-[11px] text-slate-600">
              <span>1s</span>
              <span>5s</span>
            </div>
          </div>

          <div>
            <p className="mb-2 flex items-center justify-between text-xs font-medium uppercase tracking-wider text-slate-500">
              <span>Pause after translation</span>
              <span className="rounded-md bg-night-800 px-2 py-0.5 font-mono text-neon-cyan">
                {(settings.translationGapMs / 1000).toFixed(1)}s
              </span>
            </p>
            <input
              type="range"
              min={0}
              max={3000}
              step={100}
              value={settings.translationGapMs}
              onChange={(e) => onChange({ translationGapMs: Number(e.target.value) })}
              className="w-full accent-neon-cyan"
            />
            <div className="flex justify-between text-[11px] text-slate-600">
              <span>0s</span>
              <span>3s</span>
            </div>
          </div>

          <div className="flex flex-col gap-4 sm:col-span-2">
            <Toggle
              checked={settings.loop}
              onChange={(v) => onChange({ loop: v })}
              label="Loop the whole list"
            />
            <Toggle
              checked={settings.cachedAudio}
              onChange={(v) => onChange({ cachedAudio: v })}
              label="Prefer cached audio (offline playback)"
            />
            <Toggle
              checked={settings.showHints}
              onChange={(v) => onChange({ showHints: v })}
              label="Show emoji hints on word cards"
              hint="A contextual emoji for each word — works offline"
            />
          </div>

          <div className="sm:col-span-2">
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-500">
              Sleep timer
            </p>
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                onClick={() => onSleepChange(null)}
                className={`rounded-xl px-3 py-2 text-sm font-semibold transition active:scale-95 ${
                  sleepMinutes === null
                    ? 'bg-night-800 text-slate-400'
                    : 'bg-night-800 text-slate-400 hover:text-white'
                }`}
              >
                Off
              </button>
              {SLEEP_PRESETS.map((min) => (
                <button
                  key={min}
                  onClick={() => {
                    setCustomMin('');
                    onSleepChange(min);
                  }}
                  className={`rounded-xl px-3 py-2 text-sm font-semibold transition active:scale-95 ${
                    sleepMinutes === min
                      ? 'bg-neon-amber/20 text-neon-amber ring-1 ring-neon-amber/50'
                      : 'bg-night-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {min}m
                </button>
              ))}
              <span className="flex items-center gap-1 rounded-xl bg-night-800 px-2 py-1.5">
                <input
                  type="number"
                  min={1}
                  max={180}
                  placeholder="Custom"
                  value={customMin}
                  onChange={(e) => {
                    const v = e.target.value;
                    setCustomMin(v);
                    const n = Number(v);
                    if (v !== '' && n >= 1 && n <= 180) onSleepChange(n);
                  }}
                  className="w-16 bg-transparent text-sm text-slate-300 outline-none placeholder:text-slate-600"
                  aria-label="Custom sleep timer minutes"
                />
                <span className="text-xs text-slate-500">m</span>
              </span>
            </div>
            <p className="mt-2 text-[11px] text-slate-500">
              {sleepRemaining !== null && sleepMinutes !== null
                ? `🌙 Stops in ${formatCountdown(sleepRemaining)} — volume fades out during the last 15 seconds.`
                : 'Volume fades out smoothly over the last 15 seconds, then playback stops.'}
            </p>
          </div>

          <div className="flex flex-col gap-4 sm:col-span-2">
            <VoicePicker
              label={`Target voice (${targetLang})`}
              lang={targetLang}
              value={settings.targetVoiceURI}
              voices={voices}
              loading={voicesLoading}
              onChange={(uri) => onChange({ targetVoiceURI: uri })}
            />
            <VoicePicker
              label={`Translation voice (${nativeLang})`}
              lang={nativeLang}
              value={settings.translationVoiceURI}
              voices={voices}
              loading={voicesLoading}
              onChange={(uri) => onChange({ translationVoiceURI: uri })}
            />
          </div>
        </div>
      )}
    </section>
  );
}
