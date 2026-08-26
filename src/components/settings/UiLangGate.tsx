'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { autoDetectUiLang } from '@/lib/i18n/detect';
import { getSettingsSnapshot, subscribeSettings } from '@/lib/settingsStore';

/**
 * First-visit browser-locale detection (mn → Монгол). Mounted once in the
 * root layout next to ThemeManager; renders nothing. All work happens in a
 * post-mount effect, so SSR output is always English and hydration never
 * mismatches.
 */
export default function UiLangGate() {
  const uiLang = useSyncExternalStore(
    subscribeSettings,
    () => getSettingsSnapshot().uiLang === 'mn' ? 'mn' : 'en',
    () => 'en' as const,
  );

  useEffect(() => {
    void autoDetectUiLang().catch(() => {
      /* detection is best-effort — English default always stands */
    });
  }, []);

  // The document language is more than metadata: it lets shared CSS give
  // longer Mongolian labels room to breathe without changing the learning
  // content or shrinking the entire app for English users.
  useEffect(() => {
    document.documentElement.lang = uiLang;
  }, [uiLang]);

  return null;
}
