'use client';

import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { isPublicPath } from '@/lib/publicRoutes';
import { useT } from '@/lib/i18n';
import FirstSessionGuide from '@/components/onboarding/FirstSessionGuide';
import StatePanel from '@/components/common/StatePanel';
import AuthScreen from './AuthScreen';

function Splash() {
  const t = useT();
  return (
    <main className="flex min-h-full flex-1 flex-col items-center justify-center gap-5 px-5">
      <StatePanel kind="loading" title={t('common.loading')} compact />
    </main>
  );
}

/**
 * Layout-level gate. While the session restores it shows a splash; after an
 * explicit sign-out it shows the login screen; guests and signed-in users get
 * the app. Mounting the gate here means every route (home, player, stats) is
 * protected, and pages never mount (no audio, no effects) until auth resolves.
 */
export default function AuthGate({ children }: { children: React.ReactNode }) {
  const { status, user } = useAuth();
  const pathname = usePathname();

  // The marketing landing page (root /) and the public legal pages are open —
  // no splash or login gate there, so visitors can read the pitch and the
  // Privacy / Terms / Refund documents without an account.
  if (isPublicPath(pathname)) return <>{children}</>;

  if (status === 'loading') return <Splash />;
  if (status === 'signed-out') return <AuthScreen mode="gate" />;
  if (status === 'signed-in' && user) {
    return (
      <>
        {children}
        <FirstSessionGuide key={user.id} uid={user.id} />
      </>
    );
  }
  return <>{children}</>;
}
