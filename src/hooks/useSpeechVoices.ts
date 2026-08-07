'use client';

import { useCallback, useEffect, useState } from 'react';
import type { TTSEngine, TTSEngineVoice } from '@/lib/tts/engine';
import { SpeechSynthesisEngine } from '@/lib/tts/speechSynthesisEngine';

/** Pick the best voice for a language, preferring offline (localService) voices. */
export function pickVoice(voices: TTSEngineVoice[], lang: string): TTSEngineVoice | undefined {
  const target = lang.toLowerCase();
  const prefix = target.split('-')[0];
  const local = voices.filter((v) => v.localService);
  const pool = local.length > 0 ? local : voices;
  return (
    pool.find((v) => v.lang.toLowerCase() === target) ??
    pool.find((v) => v.lang.toLowerCase().startsWith(prefix))
  );
}

export function useSpeechVoices(engine?: TTSEngine) {
  const [voices, setVoices] = useState<TTSEngineVoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    const active = engine ?? new SpeechSynthesisEngine();
    active.loadVoices().then((v) => {
      if (alive) {
        setVoices(v);
        setLoading(false);
      }
    });
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const onChanged = () => {
        if (alive) setVoices(active.getVoices());
      };
      window.speechSynthesis.addEventListener('voiceschanged', onChanged);
      return () => {
        alive = false;
        window.speechSynthesis.removeEventListener('voiceschanged', onChanged);
      };
    }
    return () => {
      alive = false;
    };
  }, [engine]);

  const byLang = useCallback((lang: string) => pickVoice(voices, lang), [voices]);
  return { voices, loading, byLang };
}
