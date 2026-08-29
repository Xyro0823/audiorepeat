import type { ReactNode } from 'react';
import BackToPreviousPage from './BackToPreviousPage';

export default function AccountPageShell({ title, intro, children }: { title: string; intro: string; children: ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-8 md:py-12">
      <BackToPreviousPage label="← Back" />
      <header className="mt-6 border-b border-white/10 pb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Account</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">{title}</h1>
        <p className="mt-2 text-slate-400">{intro}</p>
      </header>
      <section className="mt-6 space-y-4 text-slate-300">{children}</section>
    </main>
  );
}
