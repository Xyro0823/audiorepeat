"use client";

import { ArrowRight, Headphones, Repeat2, Sparkles } from "lucide-react";
import { SUPPORTED_LANGUAGE_COUNT } from "@/lib/freeLang";

const WAVEFORM = [28, 44, 66, 36, 78, 52, 92, 64, 42, 74, 56, 86, 48, 70, 34, 58, 40, 76, 50, 30];

const Hero = () => {
  const scrollToLibrary = () => {
    document
      .getElementById("vocab-grid")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const openBrowseLibrary = () => {
    window.dispatchEvent(new CustomEvent("audiorepeat:open-browse"));
  };

  return (
    <section className="hero-studio relative overflow-hidden px-5 pb-24 pt-16 sm:px-8 sm:pb-28 sm:pt-20 lg:px-12 lg:pb-32 lg:pt-24">
      <div aria-hidden className="hero-studio-grid absolute inset-0" />
      <div aria-hidden className="hero-studio-orbit absolute -right-36 -top-52 h-[560px] w-[560px] rounded-full sm:-right-20 lg:right-8" />

      <div className="relative z-10 mx-auto grid w-full max-w-7xl items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(420px,0.82fr)] lg:gap-16">
        <div className="max-w-3xl text-left">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/[0.07] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-200">
            <Headphones className="h-3.5 w-3.5" aria-hidden />
            Listen · Repeat · Remember
          </div>

          <h1 className="max-w-3xl text-[clamp(3.25rem,7vw,6.8rem)] font-normal italic leading-[0.82] tracking-[-0.045em] text-white">
            Learn by listening,
            <span className="mt-2 block text-cyan-200">not by staring.</span>
          </h1>

          <p className="mt-7 max-w-xl font-body text-base font-light leading-7 text-slate-300 sm:text-lg">
            Build a vocabulary loop, put your screen away, and let every word return until it sticks. Practice hands-free in {SUPPORTED_LANGUAGE_COUNT} languages.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={scrollToLibrary}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-white px-6 text-sm font-semibold text-slate-950 transition hover:bg-cyan-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
            >
              Start a listening loop
              <ArrowRight className="h-4 w-4" aria-hidden />
            </button>
            <button
              type="button"
              onClick={openBrowseLibrary}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-6 text-sm font-semibold text-white transition hover:border-white/25 hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
            >
              Browse ready-made sets
            </button>
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-xl lg:max-w-none" aria-hidden="true">
          <div className="hero-player relative overflow-hidden rounded-[2rem] border border-white/12 bg-[#0b0d15]/90 p-5 shadow-[0_34px_100px_rgba(0,0,0,0.55)] sm:p-7">
            <div className="flex items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-cyan-300 text-slate-950">
                  <Headphones className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">Japanese essentials</p>
                  <p className="mt-0.5 text-[11px] text-slate-500">Hands-free loop · 12 minutes</p>
                </div>
              </div>
              <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-violet-400/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-violet-200">
                <span className="h-1.5 w-1.5 rounded-full bg-violet-300" /> Playing
              </span>
            </div>

            <div className="my-8 flex h-24 items-center justify-center gap-[5px] sm:gap-1.5">
              {WAVEFORM.map((height, index) => (
                <span
                  key={`${height}-${index}`}
                  className="hero-wave-bar w-1 rounded-full bg-gradient-to-t from-violet-500 via-cyan-300 to-white sm:w-1.5"
                  style={{ height: `${height}%`, animationDelay: `${index * -85}ms` }}
                />
              ))}
            </div>

            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-4 text-center">
              <p className="text-2xl font-medium tracking-tight text-white sm:text-3xl">おはようございます</p>
              <p className="mt-2 text-xs text-slate-400">Good morning</p>
              <div className="mt-4 flex items-center justify-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-200">
                <Repeat2 className="h-3.5 w-3.5" /> Repeats 3× · then next word
              </div>
            </div>

            <div className="mt-5 flex items-center justify-between gap-3 text-[11px] text-slate-500">
              <span>18 of 40 words</span>
              <div className="h-1.5 min-w-20 flex-1 overflow-hidden rounded-full bg-white/[0.07]">
                <div className="h-full w-[45%] rounded-full bg-cyan-300" />
              </div>
              <span>45%</span>
            </div>
          </div>

          <div className="hero-float-chip absolute -bottom-5 -left-2 flex items-center gap-2 rounded-2xl border border-white/10 bg-[#121521] px-3.5 py-2.5 text-xs font-medium text-slate-200 shadow-xl sm:-left-8">
            <Sparkles className="h-4 w-4 text-amber-300" /> Screen-free practice
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
