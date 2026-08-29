import AccountPageShell from '@/components/account/AccountPageShell';

export default function PersonalizationPage() {
  return <AccountPageShell title="Personalization" intro="Choose how AudioRepeat feels while you practice.">
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <h2 className="font-semibold text-white">Your learning experience</h2>
      <p className="mt-2 text-sm leading-6 text-slate-400">Playback voice, translation order, reminder time, and language choices are all available in Settings.</p>
    </div>
  </AccountPageShell>;
}
