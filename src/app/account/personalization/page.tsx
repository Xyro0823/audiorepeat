import AccountPageShell from '@/components/account/AccountPageShell';
import Link from 'next/link';
import { ArrowRight, Headphones, Languages, MoonStar, SlidersHorizontal } from 'lucide-react';

export default function PersonalizationPage() {
  return <AccountPageShell title="Personalization" intro="Choose how AudioRepeat feels while you practice.">
    <div className="rounded-2xl border border-white/10 bg-night-900/55 p-5 sm:p-6">
      <div className="flex items-start gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-neon-violet/10 text-neon-violet"><SlidersHorizontal className="h-5 w-5" /></span><div><h2 className="font-semibold text-white">Your learning experience</h2><p className="mt-1 text-sm leading-6 text-slate-400">Make the player feel natural for your routine, then save the choices for every set.</p></div></div>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {[[Headphones, 'Listening', 'Voice, speed, repeats'], [Languages, 'Language', 'UI and translation'], [MoonStar, 'Focus', 'Theme and reminders']].map(([Icon, title, detail]) => { const IconComponent = Icon as typeof Headphones; return <div key={title as string} className="rounded-xl border border-white/10 bg-white/[0.025] p-3"><IconComponent className="h-4 w-4 text-neon-cyan" /><p className="mt-2 text-sm font-semibold text-white">{title as string}</p><p className="mt-0.5 text-xs text-slate-500">{detail as string}</p></div>; })}
      </div>
      <Link href="/settings" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-neon-cyan px-4 py-2.5 text-sm font-bold text-night-950 transition hover:brightness-110">Open settings <ArrowRight className="h-4 w-4" /></Link>
    </div>
  </AccountPageShell>;
}
