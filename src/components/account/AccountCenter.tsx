'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, CircleHelp, FileText, LogOut, Palette, Settings, ShieldCheck, Sparkles } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

function AccountLink({ href, icon, title, detail }: { href: string; icon: React.ReactNode; title: string; detail: string }) {
  return (
    <Link href={href} className="group flex items-center gap-3 rounded-2xl border border-white/10 bg-night-900/55 p-4 transition hover:-translate-y-0.5 hover:border-neon-cyan/30 hover:bg-white/[0.055] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-neon-cyan transition group-hover:border-neon-cyan/30 group-hover:bg-neon-cyan/10">{icon}</span>
      <span className="min-w-0 flex-1"><span className="block font-semibold text-white">{title}</span><span className="mt-0.5 block text-sm text-slate-400">{detail}</span></span>
      <ArrowRight className="h-4 w-4 shrink-0 text-slate-600 transition group-hover:translate-x-0.5 group-hover:text-neon-cyan" aria-hidden />
    </Link>
  );
}

export default function AccountCenter() {
  const { status, user, logout } = useAuth();
  const router = useRouter();

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6 sm:px-6 md:py-10">
      <Link href="/dashboard" scroll={false} className="text-sm text-slate-400 transition hover:text-white">← Dashboard</Link>
      <header className="relative mt-5 overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-night-800 via-night-900 to-neon-violet/[0.08] px-5 py-6 shadow-[0_18px_55px_rgba(0,0,0,0.2)] sm:flex sm:items-center sm:gap-5 sm:px-7">
        <div aria-hidden className="absolute -right-10 -top-14 h-44 w-44 rounded-full bg-neon-cyan/10 blur-3xl" />
        <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-neon-cyan/30 bg-neon-cyan/10 text-xl font-bold text-neon-cyan">{(user?.username ?? 'A').slice(0, 1).toUpperCase()}</div>
        <div className="relative mt-4 sm:mt-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-neon-cyan">Your account</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-white">{user?.username ?? 'Your account'}</h1>
          <p className="mt-1 text-sm text-slate-400">{user?.email ?? (status === 'loading' ? 'Loading account…' : 'Manage your AudioRepeat account')}</p>
        </div>
      </header>
      <section className="mt-5 grid gap-3 sm:grid-cols-2">
        <AccountLink href="/checkout" icon={<Sparkles className="h-5 w-5" />} title="Plan" detail="Manage your subscription" />
        <AccountLink href="/settings" icon={<Settings className="h-5 w-5" />} title="Settings" detail="Audio, language, and playback" />
        <AccountLink href="/account/personalization" icon={<Palette className="h-5 w-5" />} title="Personalization" detail="Make practice yours" />
        <AccountLink href="/help" icon={<CircleHelp className="h-5 w-5" />} title="Help" detail="Guides, shortcuts, and support" />
        <AccountLink href="/terms" icon={<FileText className="h-5 w-5" />} title="Terms of Service" detail="Read the service terms" />
        <AccountLink href="/privacy" icon={<ShieldCheck className="h-5 w-5" />} title="Privacy" detail="How your data is handled" />
      </section>
      {status === 'signed-in' && <button type="button" onClick={() => { logout(); router.push('/'); }} className="mt-5 flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.025] px-3.5 py-2.5 text-sm font-medium text-slate-400 transition hover:border-white/20 hover:bg-white/5 hover:text-white"><LogOut className="h-4 w-4" /> Sign out</button>}
    </main>
  );
}
