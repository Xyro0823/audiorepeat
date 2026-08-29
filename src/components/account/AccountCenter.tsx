'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CircleHelp, FileText, LogOut, Palette, Settings, ShieldCheck, Sparkles } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

function AccountLink({ href, icon, title, detail }: { href: string; icon: React.ReactNode; title: string; detail: string }) {
  return (
    <Link href={href} className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan">
      <span className="text-slate-300">{icon}</span>
      <span className="min-w-0 flex-1"><span className="block font-semibold text-white">{title}</span><span className="mt-0.5 block text-sm text-slate-400">{detail}</span></span>
      <span className="text-slate-500" aria-hidden>›</span>
    </Link>
  );
}

export default function AccountCenter() {
  const { status, user, logout } = useAuth();
  const router = useRouter();

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-8 md:py-12">
      <Link href="/dashboard" className="text-sm text-slate-400 transition hover:text-white">← Dashboard</Link>
      <header className="mt-6 border-b border-white/10 pb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Account</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">{user?.username ?? 'Your account'}</h1>
        <p className="mt-1 text-slate-400">{user?.email ?? (status === 'loading' ? 'Loading account…' : 'Manage your AudioRepeat account')}</p>
      </header>
      <section className="mt-6 grid gap-3 sm:grid-cols-2">
        <AccountLink href="/checkout" icon={<Sparkles className="h-5 w-5" />} title="Plan" detail="Manage your subscription" />
        <AccountLink href="/settings" icon={<Settings className="h-5 w-5" />} title="Settings" detail="Audio, language, and playback" />
        <AccountLink href="/account/personalization" icon={<Palette className="h-5 w-5" />} title="Personalization" detail="Make practice yours" />
        <AccountLink href="/help" icon={<CircleHelp className="h-5 w-5" />} title="Help" detail="Guides, shortcuts, and support" />
        <AccountLink href="/terms" icon={<FileText className="h-5 w-5" />} title="Terms of Service" detail="Read the service terms" />
        <AccountLink href="/privacy" icon={<ShieldCheck className="h-5 w-5" />} title="Privacy" detail="How your data is handled" />
      </section>
      {status === 'signed-in' && <button type="button" onClick={() => { logout(); router.push('/'); }} className="mt-6 flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-slate-400 transition hover:bg-white/5 hover:text-white"><LogOut className="h-4 w-4" /> Sign out</button>}
    </main>
  );
}
