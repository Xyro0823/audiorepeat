import type { ReactNode } from 'react';
import BackToPreviousPage from './BackToPreviousPage';

export default function AccountPageShell({ title, intro, children }: { title: string; intro: string; children: ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6 sm:px-6 md:py-10">
      <BackToPreviousPage label="← Dashboard" />
      <header className="relative mt-5 overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-night-800 via-night-900 to-neon-violet/[0.08] px-5 py-6 shadow-[0_18px_55px_rgba(0,0,0,0.2)] sm:px-7 sm:py-7">
        <div aria-hidden className="absolute -right-10 -top-14 h-44 w-44 rounded-full bg-neon-cyan/10 blur-3xl" />
        <div className="relative">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-neon-cyan">AudioRepeat account</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">{title}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400 sm:text-base">{intro}</p>
        </div>
      </header>
      <section className="mt-5 space-y-4 text-slate-300">{children}</section>
    </main>
  );
}
