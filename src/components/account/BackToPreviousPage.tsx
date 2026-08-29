'use client';

import { useRouter } from 'next/navigation';

export default function BackToPreviousPage({ label = '← Back' }: { label?: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => router.back()}
      className="text-sm text-slate-400 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan"
    >
      {label}
    </button>
  );
}
