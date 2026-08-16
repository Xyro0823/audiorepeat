import AdminAnalytics from '@/components/admin/AdminAnalytics';

// Privileged page HTML must never be prerendered or cached — force-dynamic
// keeps it server-rendered per request and the service worker treats
// /admin/* as network-only (same policy as the other admin pages).
export const dynamic = 'force-dynamic';

export default function AdminAnalyticsPage() {
  return <AdminAnalytics />;
}
