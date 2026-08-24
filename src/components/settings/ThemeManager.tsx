'use client';

import { useEffect } from 'react';
import { useLists } from '@/hooks/useLists';
import { isUiLang } from '@/lib/i18n/types';

/**
 * Applies the persisted theme by setting `data-theme` on <html>, which the
 * theme-scoped CSS variables in globals.css react to. Mounted once in the
 * root layout so the theme applies on every page. Only writes after settings
 * finish hydrating, so the default (neon) theme is never flashed as light.
 *
 * Also mirrors the account-scoped interface language onto <html lang> for
 * a11y (screen-reader pronunciation) — same deferred-write pattern, so SSR's
 * "en" is replaced only once the real preference has loaded.
 */
export default function ThemeManager() {
  const { settings, loading } = useLists();

  useEffect(() => {
    if (loading) return;
    document.documentElement.dataset.theme = settings.theme;
  }, [settings.theme, loading]);

  useEffect(() => {
    if (loading) return;
    const lang = isUiLang(settings.uiLang) ? settings.uiLang : 'en';
    document.documentElement.lang = lang === 'mn' ? 'mn' : 'en';
  }, [settings.uiLang, loading]);

  return null;
}
