import type { Metadata } from 'next';
import '@/lib/i18n/register/stats';
import '@/lib/i18n/register/dashboard';
import StatsView from '@/components/stats/StatsView';

export const metadata: Metadata = {
  title: 'Stats',
};

export default function StatsPage() {
  return <StatsView />;
}
