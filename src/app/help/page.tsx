import Link from 'next/link';
import AccountPageShell from '@/components/account/AccountPageShell';

const links = [
  ['/help/release-notes', 'Release notes', 'See what changed in recent releases.'],
  ['/help/download-apps', 'Download apps', 'Install AudioRepeat on your device.'],
  ['/help/shortcuts', 'Keyboard shortcuts', 'Control practice without reaching for the mouse.'],
  ['/terms', 'Terms of Service', 'Read the service terms.'],
  ['/privacy', 'Privacy Policy', 'Learn how we handle your data.'],
  ['/help/report-bug', 'Report a bug', 'Send us a clear description of a problem.'],
] as const;

export default function HelpPage() {
  return <AccountPageShell title="Help center" intro="Guides, app information, and support.">
    <div className="grid gap-3 sm:grid-cols-2">{links.map(([href, title, detail]) => <Link key={href} href={href} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition hover:bg-white/[0.06]"><p className="font-semibold text-white">{title}</p><p className="mt-1 text-sm text-slate-400">{detail}</p></Link>)}</div>
  </AccountPageShell>;
}
