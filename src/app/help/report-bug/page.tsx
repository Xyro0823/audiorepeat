import AccountPageShell from '@/components/account/AccountPageShell';
import { LEGAL_IDENTITY } from '@/lib/legalIdentity';
export default function ReportBugPage() { return <AccountPageShell title="Report a bug" intro="Tell us what you expected and what happened instead."><a href={`mailto:${LEGAL_IDENTITY.supportEmail}?subject=AudioRepeat%20bug%20report`} className="inline-flex rounded-xl bg-neon-cyan px-4 py-2 text-sm font-semibold text-night-950">Email support</a></AccountPageShell>; }
