'use client';

import { useLibrarySync } from '@/hooks/useLibrarySync';
import { useAuth } from '@/hooks/useAuth';

export default function CloudSyncBadge() {
  const { user } = useAuth();
  const { phase, syncNow } = useLibrarySync();
  if (!user) return null;
  const copy = {
    idle: 'Cloud sync ready',
    syncing: 'Syncing…',
    synced: 'Synced',
    offline: 'Saved offline',
    error: 'Sync needs retry',
  }[phase];
  return (
    <button
      type="button"
      onClick={() => void syncNow()}
      disabled={phase === 'syncing'}
      title="Sync this library across your signed-in devices"
      className="inline-flex min-h-8 items-center gap-1.5 whitespace-nowrap rounded-full border border-white/10 px-2.5 text-[11px] font-medium text-slate-400 transition hover:border-neon-cyan/30 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan disabled:cursor-wait"
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
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
      {copy}
    </button>
  );
}
