'use client';

import { useMemo } from 'react';
import type { TTSEngineVoice } from '@/lib/tts/engine';

interface Props {
  label: string;
  lang: string;
  value?: string;
  voices: TTSEngineVoice[];
  loading: boolean;
  onChange: (voiceURI?: string) => void;
}

export default function VoicePicker({ label, lang, value, voices, loading, onChange }: Props) {
  const groups = useMemo(() => {
    const map = new Map<string, TTSEngineVoice[]>();
    for (const v of voices) {
      const key = v.lang.split('-')[0].toUpperCase() || 'Other';
      const list = map.get(key) ?? [];
      list.push(v);
      map.set(key, list);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [voices]);

  const matched = useMemo(() => {
    const prefix = lang.split('-')[0].toLowerCase();
    return voices.filter((v) => v.lang.toLowerCase().startsWith(prefix));
  }, [voices, lang]);

  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-slate-500">
        {label}
      </span>
      <div className="relative">
        <select
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value || undefined)}
          disabled={loading}
          className="w-full appearance-none rounded-xl border border-white/10 bg-night-800/80 px-4 py-2.5 pr-10 text-sm text-white outline-none transition focus:border-neon-cyan/60 disabled:opacity-50"
        >
          <option value="">Auto — system default for {lang}</option>
          {groups.map(([group, list]) => (
            <optgroup key={group} label={group}>
              {list.map((v) => (
                <option key={v.uri} value={v.uri}>
                  {v.name} {v.localService ? '· offline' : '· cloud'}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">
          ▾
        </span>
      </div>
      {matched.length === 0 && !loading && (
        <p className="mt-1 text-[11px] text-neon-amber">
          No voice found for {lang} on this device — the browser will fall back to its default.
        </p>
      )}
    </label>
  );
}
