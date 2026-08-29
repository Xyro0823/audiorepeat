import Link from 'next/link';
import AccountPageShell from '@/components/account/AccountPageShell';
import { ArrowRight, Bug, Download, FileText, Keyboard, LifeBuoy, Megaphone, ShieldCheck } from 'lucide-react';

const links = [
  ['/help/release-notes', 'Release notes', 'See what changed in recent releases.', Megaphone],
  ['/help/download-apps', 'Download apps', 'Install AudioRepeat on your device.', Download],
  ['/help/shortcuts', 'Keyboard shortcuts', 'Control practice without reaching for the mouse.', Keyboard],
  ['/terms', 'Terms of Service', 'Read the service terms.', FileText],
  ['/privacy', 'Privacy Policy', 'Learn how we handle your data.', ShieldCheck],
  ['/help/report-bug', 'Report a bug', 'Send us a clear description of a problem.', Bug],
] as const;

export default function HelpPage() {
  return <AccountPageShell title="Help center" intro="Guides, app information, and support.">
    <div className="rounded-2xl border border-neon-cyan/20 bg-neon-cyan/[0.045] p-4"><div className="flex gap-3"><LifeBuoy className="mt-0.5 h-5 w-5 shrink-0 text-neon-cyan" /><div><p className="font-semibold text-white">Find what you need quickly</p><p className="mt-1 text-sm leading-6 text-slate-400">Use these short guides for installing the app, finding controls, or sending feedback.</p></div></div></div>
    <div className="grid gap-3 sm:grid-cols-2">{links.map(([href, title, detail, Icon]) => <Link key={href} href={href} className="group flex min-h-32 items-start gap-3 rounded-2xl border border-white/10 bg-night-900/55 p-4 transition hover:-translate-y-0.5 hover:border-neon-cyan/30 hover:bg-white/[0.055] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.035] text-neon-cyan"><Icon className="h-5 w-5" /></span><span className="min-w-0 flex-1"><span className="flex items-center justify-between gap-2 font-semibold text-white">{title}<ArrowRight className="h-4 w-4 shrink-0 text-slate-600 transition group-hover:translate-x-0.5 group-hover:text-neon-cyan" /></span><span className="mt-1 block text-sm leading-5 text-slate-400">{detail}</span></span></Link>)}</div>
  </AccountPageShell>;
}
