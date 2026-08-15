'use client';

import Link from 'next/link';
import { ADMIN_DASHBOARD_ROUTE } from '@/lib/adminNav';

/**
 * Consistent "← Dashboard" exit control for admin pages. Lets an admin leave
 * the admin tools and return to the normal signed-in app. Navigation-only —
 * it never touches auth/authorization (the admin pages and APIs stay fully
 * server-protected regardless).
 */
export default function AdminBackNav() {
  return (
    <Link
      href={ADMIN_DASHBOARD_ROUTE}
      className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:border-white/30 hover:bg-white/5 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neon-cyan"
    >
      <span aria-hidden>←</span> Dashboard
    </Link>
  );
}
