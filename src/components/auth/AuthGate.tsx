'use client';

import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { isPublicPath } from '@/lib/publicRoutes';
import FirstSessionGuide from '@/components/onboarding/FirstSessionGuide';
import AuthScreen from './AuthScreen';

function Splash() {
  return (
    <main className="flex min-h-full flex-1 flex-col items-center justify-center gap-5 px-5">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#141433] to-night-950 shadow-[0_0_30px_rgba(34,228,255,0.25)]">
        <svg
          viewBox="0 0 24 24"
          className="h-7 w-7 text-neon-cyan drop-shadow-[0_0_6px_rgba(34,228,255,0.9)]"
          fill="currentColor"
        >
          <path d="M8 5.5v13a1 1 0 0 0 1.5.87l11-6.5a1 1 0 0 0 0-1.74l-11-6.5A1 1 0 0 0 8 5.5Z" />
        </svg>
      </div>
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-neon-cyan/30 border-t-neon-cyan" />
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
