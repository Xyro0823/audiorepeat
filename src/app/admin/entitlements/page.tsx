import { headers } from 'next/headers';
import AdminEntitlements from '@/components/admin/AdminEntitlements';

// Privileged page HTML must never be prerendered or cached — it is always
// generated per request and marked no-store (defense-in-depth on top of the
// service worker's network-only handling of /admin/*).
export const dynamic = 'force-dynamic';

export default async function AdminEntitlementsPage() {
  (await headers()).set('Cache-Control', 'no-store');
  return <AdminEntitlements />;
}
