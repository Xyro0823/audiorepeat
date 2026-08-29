'use client';

import { useRouter } from 'next/navigation';
import LeaderboardModal from '@/components/library/LeaderboardModal';

export default function LeaderboardRouteClient() {
  const router = useRouter();
  return <LeaderboardModal onClose={() => router.push('/dashboard')} />;
}
