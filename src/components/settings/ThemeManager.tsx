'use client';

import { useEffect } from 'react';
import { useLists } from '@/hooks/useLists';

/**
 * Applies the persisted theme by setting `data-theme` on <html>, which the
 * theme-scoped CSS variables in globals.css react to. Mounted once in the
 * root layout so the theme applies on every page. Only writes after settings
 * finish hydrating, so the default (neon) theme is never flashed as light.
 */
export default function ThemeManager() {
  const { settings, loading } = useLists();

  useEffect(() => {
    if (loading) return;
    document.documentElement.dataset.theme = settings.theme;
  }, [settings.theme, loading]);

  return null;
}
