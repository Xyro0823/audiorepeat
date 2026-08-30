'use client';

import { useT } from '@/lib/i18n';

/** A consistent first keyboard stop for every app route. */
export default function SkipToContent() {
  const t = useT();

  return (
    <a
      href="#main-content"
      className="fixed left-4 top-3 z-[200] -translate-y-20 rounded-full bg-white px-4 py-2 text-sm font-semibold text-night-950 transition-transform focus:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-night-950"
    >
      {t('common.skipToMainContent')}
    </a>
  );
}
