import AdminDiagnostics from '@/components/admin/AdminDiagnostics';

// Privileged page HTML must never be prerendered or cached — force-dynamic
// keeps it server-rendered per request (Next emits Cache-Control:
// no-cache,no-store for dynamic pages) and the service worker treats
// /admin/* as network-only. Note: do NOT use headers().set() here — it
// throws "Headers cannot be modified" at runtime in Next 16.
export const dynamic = 'force-dynamic';

export default function AdminDiagnosticsPage() {
  return <AdminDiagnostics />;
}
