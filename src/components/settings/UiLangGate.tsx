'use client';

import { useEffect } from 'react';
import { autoDetectUiLang } from '@/lib/i18n/detect';

/**
 * First-visit browser-locale detection (mn → Монгол). Mounted once in the
 * root layout next to ThemeManager; renders nothing. All work happens in a
 * post-mount effect, so SSR output is always English and hydration never
 * mismatches.
 */
export default function UiLangGate() {
  useEffect(() => {
    void autoDetectUiLang().catch(() => {
      /* detection is best-effort — English default always stands */
    });
  }, []);

  return null;
}
