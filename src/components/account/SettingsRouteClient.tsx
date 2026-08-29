'use client';

import { useRouter } from 'next/navigation';
import SettingsModal from '@/components/settings/SettingsModal';

export default function SettingsRouteClient() {
  const router = useRouter();
  return <SettingsModal onClose={() => router.back()} />;
}
