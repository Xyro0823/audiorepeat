'use client';

import { useLibrarySync } from '@/hooks/useLibrarySync';
import { useAuth } from '@/hooks/useAuth';
import { useT } from '@/lib/i18n';

export default function CloudSyncBadge() {
  const { user } = useAuth();
  const { phase, syncNow } = useLibrarySync();
  const t = useT();
  if (!user) return null;
  const copy = {
    idle: t('sync.state.idle'),
    syncing: t('sync.state.syncing'),
    synced: t('sync.state.synced'),
    offline: t('sync.state.offline'),
    error: t('sync.state.error'),
  }[phase];
  return (
    <button
      type="button"
      onClick={() => void syncNow()}
      disabled={phase === 'syncing'}
      title={t('dashboard.sync.title')}
      className="inline-flex min-h-9 max-w-[190px] items-center gap-1.5 rounded-full border border-white/10 px-2.5 text-[11px] font-medium text-slate-400 transition hover:border-neon-cyan/30 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan disabled:cursor-wait sm:max-w-none"
    >
      <span
        className={`h-1.5 w-1.5 shrink-0 rounded-full ${
          phase === 'synced'
            ? 'bg-neon-green'
            : phase === 'syncing'
              ? 'animate-pulse bg-neon-cyan'
              : phase === 'error'
                ? 'bg-neon-magenta'
                : 'bg-slate-500'
        }`}
        aria-hidden
      />
      <span className="truncate">{copy}</span>
    </button>
  );
}
