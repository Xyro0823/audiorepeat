'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
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

/**
 * Maximum time (ms) to wait for browser voices to load before declaring
 * them "available" (possibly empty). Chrome/Edge typically loads voices
 * within 50-200ms; Firefox can take up to ~1s. The safety net ensures the
 * UI never shows an infinite loading spinner even on an unusual platform.
 */
const VOICE_LOAD_DEADLINE_MS = 2000;

export function useSpeechVoices(engine?: TTSEngine) {
  const [voices, setVoices] = useState<TTSEngineVoice[]>([]);
  /**
   * `loading` stays true until either:
   *   - voices arrive (voiceschanged fires with a non-empty list), or
   *   - the deadline expires (voice list may be genuinely empty).
   *
   * This prevents a false "No voice" flash while the browser is still
   * populating its speechSynthesis voice registry.
   */
  const [loading, setLoading] = useState(true);
  const deadlineRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let alive = true;
    const active = engine ?? new SpeechSynthesisEngine();

    // Phase 1: kick off the engine's own voice-loading promise
    active.loadVoices().then((v) => {
      if (!alive) return;
      if (v.length > 0) {
        // Voices arrived quickly — we're done loading.
        setVoices(v);
        setLoading(false);
        if (deadlineRef.current !== null) {
          clearTimeout(deadlineRef.current);
          deadlineRef.current = null;
        }
      }
      // If v is empty, we stay in loading state until voiceschanged or the deadline.
    });

    // Phase 2: listen for voiceschanged — the authoritative signal that the
    // browser's voice list is ready (may fire before or after loadVoices resolves).
    const onVoicesChanged = () => {
      if (!alive) return;
      const fresh = active.getVoices();
      if (fresh.length > 0) {
        setVoices(fresh);
        setLoading(false);
        if (deadlineRef.current !== null) {
          clearTimeout(deadlineRef.current);
          deadlineRef.current = null;
        }
      }
    };

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.addEventListener('voiceschanged', onVoicesChanged);
    }

    // Phase 3: safety-net deadline — after this long, stop waiting and report
    // whatever we have (possibly zero voices). This handles platforms where
    // voiceschanged never fires but speech still works via u.lang fallback.
    deadlineRef.current = setTimeout(() => {
      if (!alive) return;
      const final = active.getVoices();
      setVoices(final);
      setLoading(false);
      deadlineRef.current = null;
    }, VOICE_LOAD_DEADLINE_MS);

    return () => {
      alive = false;
      if (deadlineRef.current !== null) {
        clearTimeout(deadlineRef.current);
        deadlineRef.current = null;
      }
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.removeEventListener('voiceschanged', onVoicesChanged);
      }
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
