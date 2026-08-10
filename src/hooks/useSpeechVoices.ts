'use client';

import { useCallback, useEffect, useState } from 'react';
import type { TTSEngine, TTSEngineVoice } from '@/lib/tts/engine';
import { pickVoiceForLang, SpeechSynthesisEngine } from '@/lib/tts/speechSynthesisEngine';

/**
 * Best voice for a language, preferring offline (localService) voices.
 * Shares its logic with the engine's own auto-selection (pickVoiceForLang),
 * so the UI and the player always agree on which voice will be used.
 */
export function pickVoice(voices: TTSEngineVoice[], lang: string): TTSEngineVoice | undefined {
  return pickVoiceForLang(voices, lang);
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

  const byLang = useCallback((lang: string) => pickVoiceForLang(voices, lang), [voices]);
  /** True when any installed voice can cover this language (exact or prefix match). */
  const hasVoice = useCallback(
    (lang: string) => pickVoiceForLang(voices, lang) !== undefined,
    [voices],
  );
  return { voices, loading, byLang, hasVoice };
}
