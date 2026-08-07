'use client';

import { useState } from 'react';
import type { AppSettings } from '@/types/app';
import type { TTSEngineVoice } from '@/lib/tts/engine';
import VoicePicker from './VoicePicker';

const REPEAT_OPTIONS = [1, 2, 3, 5];

interface Props {
  settings: AppSettings;
  onChange: (patch: Partial<AppSettings>) => void;
  voices: TTSEngineVoice[];
  voicesLoading: boolean;
  targetLang: string;
  nativeLang: string;
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
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
      <span className="text-sm text-slate-300">{label}</span>
    </button>
  );
}

export default function SettingsPanel({
  settings,
  onChange,
  voices,
  voicesLoading,
  targetLang,
  nativeLang,
}: Props) {
  const [open, setOpen] = useState(false);

  return (
    <section className="animate-fade-up mb-6">
      <button
        onClick={() => setOpen((o) => !o)}
        className="mx-auto flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-300 transition hover:border-neon-cyan/40 hover:text-white"
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
      </button>

      {open && (
        <div className="glass animate-fade-up mt-4 grid gap-6 rounded-2xl p-5 sm:grid-cols-2">
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
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-500">
              Pause between repeats
            </p>
            <input
              type="range"
              min={0}
              max={2000}
              step={100}
              value={settings.targetGapMs}
              onChange={(e) => onChange({ targetGapMs: Number(e.target.value) })}
              className="w-full accent-neon-cyan"
            />
            <p className="mt-1 text-[11px] text-slate-500">{settings.targetGapMs} ms</p>
          </div>

          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-500">
              Pause after translation
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
            <p className="mt-1 text-[11px] text-slate-500">{settings.translationGapMs} ms</p>
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
