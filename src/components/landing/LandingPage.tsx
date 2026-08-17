"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type RefObject } from "react";
import {
  ArrowUpRight,
  Languages,
  Mic,
  Repeat,
  WifiOff,
} from "lucide-react";
import AuthScreen from "@/components/auth/AuthScreen";
import { useAuth } from "@/hooks/useAuth";
import { useLanguageCount } from "@/hooks/useLanguageCount";
import { landingAuthAction } from "@/lib/adminNav";
import { PLAN_ORDER, PLANS } from "@/lib/plans";
import NewsletterForm from "./NewsletterForm";
import Testimonials from "./Testimonials";

/* ------------------------------------------------------------------ */
/* Shared bits                                                        */
/* ------------------------------------------------------------------ */

const NAV_LINKS = [
  { href: "#features", label: "Features" },
  { href: "#languages", label: "Languages" },
  { href: "#pricing", label: "Pricing" },
];

/** Cyan play-triangle logo mark. */
function LogoMark() {
  return (
    <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-cyan-400/30 bg-gradient-to-br from-cyan-500/20 to-blue-600/10 shadow-[0_0_18px_rgba(6,182,212,0.35),inset_0_1px_0_rgba(255,255,255,0.12)]">
      <svg
        viewBox="0 0 24 24"
        className="h-4 w-4 text-cyan-300 drop-shadow-[0_0_6px_rgba(34,211,238,0.9)]"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M8 5.5v13a1 1 0 0 0 1.5.87l11-6.5a1 1 0 0 0 0-1.74l-11-6.5A1 1 0 0 0 8 5.5Z" />
      </svg>
    </span>
  );
}

/** LIVE SESSION status pill — breathing, green dot, learner count. */
function LivePill({ count = "1,240 learners listening now" }: { count?: string }) {
  return (
    <span className="live-pill inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 backdrop-blur-xl">
      <span aria-hidden className="h-2 w-2 animate-pulse rounded-full bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.9)]" />
      <span className="text-[8px] font-bold uppercase tracking-[0.25em] text-green-400">Live Session</span>
      <span className="text-xs text-white">{count}</span>
    </span>
  );
}

/** Mini equalizer bars — pure CSS, suggests looping audio. */
function EqBars() {
  return (
    <span className="flex h-3.5 items-end gap-[3px]" aria-hidden>
      {[0.9, 1.4, 0.7, 1.1].map((h, i) => (
        <span
          key={i}
          className="eq-bar w-[3px] rounded-sm"
          style={{ height: `${h * 100}%`, animationDelay: `${i * 0.16}s` }}
        />
      ))}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Satellite media cards                                               */
/* ------------------------------------------------------------------ */

type Satellite = {
  flag: string;
  name: string;
  code: string;
  grad: string;
  words: { target: string; translation: string; rtl?: boolean }[];
};

const SATELLITES: Satellite[] = [
  {
    flag: "🇯🇵",
    name: "Japanese Greetings",
    code: "JA",
    grad: "from-cyan-500/40 via-sky-500/20 to-transparent",
    words: [
      { target: "こんにちは", translation: "Hello" },
      { target: "ありがとう", translation: "Thank you" },
    ],
  },
  {
    flag: "🇸🇦",
    name: "Arabic Essentials",
    code: "AR",
    grad: "from-blue-500/40 via-indigo-500/20 to-transparent",
    words: [
      { target: "مرحبًا", translation: "Hello", rtl: true },
      { target: "شكرًا", translation: "Thank you", rtl: true },
    ],
  },
  {
    flag: "🇫🇷",
    name: "French Phrases",
    code: "FR",
    grad: "from-sky-400/40 via-cyan-500/20 to-transparent",
    words: [
      { target: "Bonjour", translation: "Hello" },
      { target: "Merci", translation: "Thank you" },
    ],
  },
  {
    flag: "🇪🇸",
    name: "Spanish Basics",
    code: "ES",
    grad: "from-cyan-400/40 via-blue-500/20 to-transparent",
    words: [
      { target: "Hola", translation: "Hello" },
      { target: "Gracias", translation: "Thank you" },
    ],
  },
];

function SatelliteCard({ s, className = "" }: { s: Satellite; className?: string }) {
  return (
    <div className={`satellite-card group w-[240px] max-w-full p-3 ${className}`}>
      <div
        className={`sat-cover flex h-24 items-end justify-between rounded-2xl bg-gradient-to-br p-3 ${s.grad}`}
      >
        <span className="text-3xl drop-shadow-lg">{s.flag}</span>
        <span className="rounded-full bg-black/30 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.22em] text-cyan-200">
          {s.code}
        </span>
      </div>
      <div className="mt-3 flex items-center justify-between px-1">
        <span className="text-sm font-semibold text-white">{s.name}</span>
        <EqBars />
      </div>
      <div className="mt-2 space-y-1.5 px-1">
        {s.words.map((w) => (
          <div
            key={w.target}
            className="flex items-center justify-between gap-2 rounded-lg bg-white/[0.04] px-2.5 py-1.5"
          >
            <span dir={w.rtl ? "rtl" : undefined} className="text-[12px] font-medium text-cyan-100">
              {w.target}
            </span>
            <span className="text-[11px] text-slate-400">{w.translation}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Neural connection lines — dynamically anchored to the real cards    */
/* ------------------------------------------------------------------ */

type NeuralLine = { x1: number; y1: number; x2: number; y2: number };

/**
 * Draws the bezier branches that connect the satellite cards to the central
 * hero node. Coordinates are measured live via getBoundingClientRect() on
 * mount and on resize, so the lines stay glued to the cards at any
 * resolution. The overlay is pointer-events-none so it never blocks clicks.
 */
function NeuralConnections({
  containerRef,
  nodeRef,
  cardRefs,
}: {
  containerRef: RefObject<HTMLDivElement | null>;
  nodeRef: RefObject<HTMLDivElement | null>;
  cardRefs: RefObject<(HTMLDivElement | null)[]>;
}) {
  const [geo, setGeo] = useState<{ w: number; h: number; lines: NeuralLine[] }>({
    w: 0,
    h: 0,
    lines: [],
  });

  useEffect(() => {
    const measure = () => {
      const cont = containerRef.current;
      const node = nodeRef.current;
      if (!cont || !node) return;
      const cr = cont.getBoundingClientRect();
      const nr = node.getBoundingClientRect();
      if (cr.width === 0 || cr.height === 0) return;

      const lines: NeuralLine[] = [];
      (cardRefs.current ?? []).forEach((card, i) => {
        if (!card || i >= 4) return;
        const r = card.getBoundingClientRect();
        // i 0/1 = left column (Japanese, French) → inner right edge;
        // i 2/3 = right column (Arabic, Spanish) → inner left edge.
        const isLeft = i < 2;
        const x1 = (isLeft ? r.right : r.left) - cr.left;
        const y1 = (r.top + r.bottom) / 2 - cr.top;
        const x2 = (isLeft ? nr.left : nr.right) - cr.left;
        const y2 = Math.min(Math.max(y1, nr.top + 10 - cr.top), nr.bottom - 10 - cr.top);
        lines.push({ x1, y1, x2, y2 });
      });

      setGeo({ w: cr.width, h: cr.height, lines });
    };

    measure();
    const ro = new ResizeObserver(measure);
    if (containerRef.current) ro.observe(containerRef.current);
    window.addEventListener("resize", measure);
    // Re-measure once fonts/layout settle.
    const t = window.setTimeout(measure, 400);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
      window.clearTimeout(t);
    };
  }, [containerRef, nodeRef, cardRefs]);

  return (
    <div
      className="pointer-events-none absolute inset-0 z-10 hidden h-full w-full lg:block"
      aria-hidden
    >
      {geo.w > 0 && geo.h > 0 && (
        <svg
          className="h-full w-full"
          viewBox={`0 0 ${geo.w} ${geo.h}`}
          preserveAspectRatio="none"
        >
          <defs>
            {/* cyan-400 → blue-500 horizontal gradient stroke */}
            <linearGradient id="neural-line" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#22d3ee" />
              <stop offset="100%" stopColor="#3b82f6" />
            </linearGradient>
          </defs>
          {geo.lines.map((l, i) => {
            const mx = (l.x1 + l.x2) / 2;
            // Continuous horizontal bezier: enters the card border horizontally
            // (C1-continuous) and lands on the node border, arching slightly.
            return (
              <path
                key={i}
                className="node-line"
                vectorEffect="non-scaling-stroke"
                d={`M ${l.x1} ${l.y1} C ${mx} ${l.y1 - 5}, ${mx} ${l.y2 + 5}, ${l.x2} ${l.y2}`}
              />
            );
          })}
        </svg>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Landing page                                                        */
/* ------------------------------------------------------------------ */

export default function LandingPage() {
  const [annual, setAnnual] = useState(true);
  const { status } = useAuth();
  const [showAuth, setShowAuth] = useState(false);
  const landingAction = landingAuthAction(status);
  const langCount = useLanguageCount();
  const heroRef = useRef<HTMLDivElement | null>(null);
  const nodeRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Single source of pricing truth (shared with /checkout) — the shape below
  // keeps the pricing JSX unchanged while prices live in src/lib/plans.ts.
  const plans = PLAN_ORDER.map((id) => {
    const p = PLANS[id];
    const { price, note } = p.priceFor(annual);
    return {
      name: p.name,
      tagline: p.tagline,
      plan: id,
      price,
      monthlyNote: note,
      features: p.features(langCount),
      cta: p.cta,
      popular: p.popular,
    };
  });

  const voices = [
    { flag: "🇯🇵", name: "Yuki Tanaka", role: "NATIVE JAPANESE VOICE", grad: "from-cyan-500/45 via-sky-500/15 to-transparent" },
    { flag: "🇫🇷", name: "Claire Dubois", role: "AUDIO CURATOR", grad: "from-sky-400/45 via-cyan-500/15 to-transparent" },
    { flag: "🇸🇦", name: "Layla Haddad", role: "NATIVE ARABIC VOICE", grad: "from-blue-500/45 via-indigo-500/15 to-transparent" },
    { flag: "🇪🇸", name: "Mateo Ruiz", role: "NATIVE SPANISH VOICE", grad: "from-cyan-400/45 via-blue-500/15 to-transparent" },
  ];

  const features = [
    {
      icon: Repeat,
      title: "Spaced Repetition Audio Loop",
      text: "Words resurface at the right intervals — hear them, then test yourself, until they stick for good.",
    },
    {
      icon: WifiOff,
      title: "Offline Audio Player",
      text: "Download your sets and drill anywhere. Plane, train, subway — zero bars, zero interruptions.",
    },
    {
      icon: Mic,
      title: "AI Pronunciation Assistant",
      text: "Neural TTS voices pronounce every word natively. Slow it down, loop it, shadow it back.",
    },
    {
      icon: Languages,
      title: "250+ Native Speaker Sets",
      text: "Curated starter packs from A1 to C2 across the world's most-spoken languages.",
    },
  ];

  return (
    <div id="landing" className="relative min-h-screen overflow-x-clip bg-[#0a0a0a] text-[#e8eaef]">
      {/* Ambient background: dot grid + cyan radials */}
      <div className="pointer-events-none fixed inset-0" aria-hidden>
        <div className="bg-dots absolute inset-0" />
        <div className="absolute inset-0 bg-[radial-gradient(1000px_620px_at_72%_-12%,rgba(6,182,212,0.12),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(900px_540px_at_8%_112%,rgba(59,130,246,0.1),transparent_60%)]" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent" />
      </div>

      {/* Fixed top navbar */}
      <nav className="fixed inset-x-0 top-0 z-50 border-b border-white/5 bg-[#0a0a0a]/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-6 lg:px-12">
          <Link href="/" className="flex items-center gap-2.5">
            <LogoMark />
            {/* Wordmark hidden on ultra-narrow screens so the logo mark +
                Sign in + Start Practice always fit without overflow. */}
            <span className="hidden text-lg font-extrabold tracking-tight text-white min-[400px]:inline">
              Audio<span className="text-cyan-400">Repeat</span>
            </span>
          </Link>

          <div className="hidden items-center gap-8 md:flex">
            {NAV_LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-400 transition-colors hover:text-cyan-300"
              >
                {l.label}
              </a>
            ))}
          </div>

          {/* Auth-aware secondary action: Sign in (signed out) / Dashboard
              (signed in). Hidden while auth is loading so the wrong state
              never flashes; the primary CTA is always Start Practice. */}
          <div className="flex items-center gap-2.5">
            {landingAction?.kind === 'link' ? (
              <Link
                href={landingAction.href}
                className="rounded-full border border-white/20 bg-white/5 px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-white/10 active:scale-95"
              >
                {landingAction.label}
              </Link>
            ) : landingAction?.kind === 'auth' ? (
              <button
                type="button"
                onClick={() => setShowAuth(true)}
                className="rounded-full border border-white/20 bg-white/5 px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-white/10 active:scale-95"
              >
                {landingAction.label}
              </button>
            ) : null}
            <Link
              href="/dashboard"
              className="rounded-full bg-white px-5 py-2 text-[13px] font-semibold text-black shadow-[0_4px_20px_rgba(255,255,255,0.15)] transition hover:bg-slate-100 active:scale-95"
            >
              Start Practice
            </Link>
          </div>
        </div>
      </nav>

      {/* ------------------------------------------------------------ */}
      {/* Hero — central neural node + satellites + SVG connections    */}
      {/* ------------------------------------------------------------ */}
      {/* Hero — central node + satellites + SVG connections. Mobile stacks the
          node first with the satellites below; md+ uses a symmetric 12-col grid
          (3 | 6 | 3) with equal gaps so nothing ever overlaps. */}
      <header ref={heroRef} className="relative mx-auto w-full max-w-7xl px-4 pt-24 md:px-8 lg:pt-28">
        {/* Neural connection lines — dynamically anchored to the cards (lg+ only) */}
        <NeuralConnections containerRef={heroRef} nodeRef={nodeRef} cardRefs={cardRefs} />

        {/* Responsive grid — below lg: single centered column with the node only
            (satellites are purely decorative, hidden on mobile/tablet); lg+:
            symmetric 12-col grid (3 | 6 | 3). */}
        <div className="relative z-10 mx-auto grid w-full max-w-7xl grid-cols-1 gap-6 lg:grid-cols-12 lg:items-center lg:justify-center lg:gap-6">
          {/* left satellites — Japanese, French (lg+ only) */}
          <div className="hidden lg:flex lg:col-span-3 lg:col-start-1 lg:flex-col lg:items-end lg:gap-6">
            <div ref={(el) => { cardRefs.current[0] = el; }}>
              <SatelliteCard s={SATELLITES[0]} />
            </div>
            <div ref={(el) => { cardRefs.current[1] = el; }}>
              <SatelliteCard s={SATELLITES[2]} />
            </div>
          </div>

          {/* Central node */}
          <div className="mx-auto w-full max-w-md lg:col-span-6 lg:col-start-4 lg:max-w-4xl lg:justify-self-center">
            <div ref={nodeRef} className="glass-neural neural-glow relative overflow-hidden rounded-[2rem] px-6 py-8 text-center">
              {/* cyan sheen */}
              <div
                className="pointer-events-none absolute -top-32 left-1/2 h-72 w-[42rem] -translate-x-1/2 rounded-full bg-cyan-500/15 blur-3xl"
                aria-hidden
              />

              <p className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-300">
                <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_8px_rgba(103,232,249,0.9)]" />
                AI-powered audio drilling
              </p>

              <h1 className="mx-auto mt-5 max-w-3xl font-extrabold leading-tight tracking-tight text-white text-3xl md:text-5xl lg:text-6xl">
                Master Any Language with{" "}
                <span className="bg-gradient-to-r from-[#22d3ee] via-[#06b6d4] to-[#3b82f6] bg-clip-text text-transparent">
                  Hands-Free Audio Repeat
                </span>
              </h1>

              <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-slate-400 md:text-[15px]">
                Loop, repeat and retain vocabulary while you commute, cook or wind down.
                Neural audio, spaced repetition and {langCount} languages — no screen required.
              </p>

              <div className="mt-7 flex flex-wrap items-center justify-center gap-4">
                <Link
                  href="/dashboard"
                  className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 px-6 py-3 font-semibold text-white shadow-lg shadow-cyan-500/20 transition hover:brightness-110 active:scale-95"
                >
                  Start Learning Now
                  <ArrowUpRight className="h-4 w-4" aria-hidden />
                </Link>
                <Link
                  href="/dashboard#vocab-grid"
                  className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-6 py-3 font-semibold text-white transition hover:bg-white/10 active:scale-95"
                >
                  Explore Library
                </Link>
              </div>

              <p className="mt-5 text-[11px] uppercase tracking-[0.2em] text-slate-500">
                No pressure · No commitment · Just listening
              </p>
            </div>

            {/* Live pill under the node */}
            <div className="mt-5 flex justify-center">
              <LivePill />
            </div>
          </div>

          {/* right satellites — Arabic, Spanish (lg+ only) */}
          <div className="hidden lg:flex lg:col-span-3 lg:col-start-10 lg:flex-col lg:items-start lg:gap-6">
            <div ref={(el) => { cardRefs.current[2] = el; }}>
              <SatelliteCard s={SATELLITES[1]} />
            </div>
            <div ref={(el) => { cardRefs.current[3] = el; }}>
              <SatelliteCard s={SATELLITES[3]} />
            </div>
          </div>
        </div>
      </header>

      {/* ------------------------------------------------------------ */}
      {/* Features grid                                               */}
      {/* ------------------------------------------------------------ */}
      <section id="features" className="mx-auto w-full max-w-6xl scroll-mt-28 px-6 pb-24 pt-28 lg:px-12">
        <div className="text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-400">Why AudioRepeat</p>
          <h2 className="mt-3 text-4xl font-extrabold tracking-tight text-white md:text-5xl">
            An audio engine built for retention
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-slate-400">
            Every feature is engineered around one idea: your ears are the fastest
            path to fluency.
          </p>
        </div>

        <div className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f, i) => (
            <div
              key={f.title}
              className="glass-neural group rounded-3xl p-6 hover:-translate-y-1 hover:border-cyan-400/40"
              style={{ animationDelay: `${i * 90}ms` }}
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#06b6d4]/10 transition-transform duration-300 group-hover:scale-110">
                <f.icon className="h-6 w-6 text-[#22d3ee]" aria-hidden />
              </div>
              <h3 className="mt-4 text-xl font-bold text-white">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------ */}
      {/* Languages                                                     */}
      {/* ------------------------------------------------------------ */}
      <section id="languages" className="mx-auto w-full max-w-6xl scroll-mt-28 px-6 pb-28 lg:px-12">
        <div className="glass-neural rounded-[2rem] p-8 text-center md:p-12">
          <h2 className="text-4xl font-extrabold tracking-tight text-white md:text-5xl">
            {langCount} languages. <span className="bg-gradient-to-r from-[#22d3ee] to-[#3b82f6] bg-clip-text text-transparent">One tap away.</span>
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-slate-400">
            From Arabic to Zulu — native neural voices, real word packs, zero setup.
          </p>
          <div className="mx-auto mt-8 flex max-w-2xl flex-wrap items-center justify-center gap-2">
            {[
              ["🇪🇸", "Spanish"],
              ["🇫🇷", "French"],
              ["🇩🇪", "German"],
              ["🇯🇵", "Japanese"],
              ["🇨🇳", "Chinese"],
              ["🇮🇹", "Italian"],
              ["🇰🇷", "Korean"],
              ["🇸🇦", "Arabic"],
              ["🇵🇹", "Portuguese"],
              ["🇷🇺", "Russian"],
              ["🇹🇷", "Turkish"],
              ["🇳🇱", "Dutch"],
            ].map(([flag, name]) => (
              <span
                key={name}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[13px] font-medium text-cyan-100 transition hover:border-cyan-400/50 hover:bg-cyan-500/10"
              >
                <span aria-hidden>{flag}</span> {name}
              </span>
            ))}
            <span className="inline-flex items-center rounded-full px-3 py-1.5 text-[13px] font-medium text-slate-500">
              + {Math.max(0, langCount - 12)} more
            </span>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ */}
      {/* Pricing                                                      */}
      {/* ------------------------------------------------------------ */}
      <section id="pricing" className="mx-auto w-full max-w-6xl scroll-mt-28 px-6 pb-28 lg:px-12">
        <div className="text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-400">Pricing</p>
          <h2 className="mt-3 text-4xl font-extrabold tracking-tight text-white md:text-5xl">
            Learn at your pace, pay your way
          </h2>

          {/* monthly / annual toggle */}
          <div className="mt-8 inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] p-1">
            <button
              type="button"
              onClick={() => setAnnual(false)}
              className={`rounded-full px-5 py-2 text-[13px] font-semibold transition-all ${
                !annual ? "bg-white text-black shadow" : "text-slate-400 hover:text-white"
              }`}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setAnnual(true)}
              className={`rounded-full px-5 py-2 text-[13px] font-semibold transition-all ${
                annual ? "bg-white text-black shadow" : "text-slate-400 hover:text-white"
              }`}
            >
              Annual <span className="ml-1 text-[10px] font-bold text-emerald-400">−20%</span>
            </button>
          </div>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
          {plans.map((p) => (
            <div
              key={p.name}
              className={`glass-neural relative flex flex-col rounded-[2rem] p-8 ${
                p.popular
                  ? "border-cyan-400/50 shadow-[0_0_60px_rgba(6,182,212,0.15)] md:-mt-4 md:mb-4"
                  : ""
              }`}
            >
              {p.popular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-[#06b6d4] to-[#3b82f6] px-4 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-white shadow-[0_0_20px_rgba(6,182,212,0.5)]">
                  Most Popular
                </span>
              )}
              <h3 className="text-lg font-bold text-white">{p.name}</h3>
              <p className="mt-1 text-[13px] text-slate-400">{p.tagline}</p>
              <div className="mt-6 flex items-end gap-2">
                <span className="text-5xl font-extrabold tracking-tight text-white">
                  ${p.price}
                </span>
                <span className="pb-1.5 text-xs text-slate-500">{p.monthlyNote}</span>
              </div>
              <ul className="mt-7 space-y-3">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-slate-300">
                    <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-cyan-500/15">
                      <svg viewBox="0 0 24 24" className="h-2.5 w-2.5 text-cyan-300" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d="m5 13 4 4L19 7" />
                      </svg>
                    </span>
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href={`/checkout?plan=${p.plan}`}
                className={`mt-8 inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold transition ${
                  p.popular ? "btn-neural" : "glass-neural text-white hover:bg-white/[0.07]"
                }`}
              >
                {p.cta}
                <ArrowUpRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------ */}
      {/* Native voices                                                 */}
      {/* ------------------------------------------------------------ */}
      <section className="mx-auto w-full max-w-6xl px-6 pb-28 lg:px-12">
        <div className="text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-400">The human layer</p>
          <h2 className="mt-3 text-4xl font-extrabold tracking-tight text-white md:text-5xl">
            Voices you can trust
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-slate-400">
            Native curators and voice artists behind every pack — real people,
            real pronunciation, real culture.
          </p>
        </div>

        <div className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-2">
          {voices.map((v) => (
            <div key={v.name} className="glass-neural group flex gap-5 rounded-[2rem] p-5 hover:border-cyan-400/30">
              <div className="relative aspect-[4/5] w-36 shrink-0 overflow-hidden rounded-2xl bg-gradient-to-br grayscale transition-all duration-700 group-hover:grayscale-0 md:w-40">
                <div className={`absolute inset-0 bg-gradient-to-br ${v.grad}`} />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-6xl drop-shadow-lg">{v.flag}</span>
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
              </div>
              <div className="flex flex-col justify-center py-2">
                <span className="text-[10px] font-thin uppercase tracking-[0.3em] text-cyan-400">
                  {v.role}
                </span>
                <h3 className="mt-2 text-xl font-bold text-white">{v.name}</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-slate-400">
                  {v.role.includes("VOICE")
                    ? "Recorded thousands of clean, natural audio takes for hands-free learning."
                    : "Hand-picks every word so your first hour feels like your hundredth."}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------ */}
      {/* Testimonials                                                  */}
      {/* ------------------------------------------------------------ */}
      <Testimonials />

      {/* ------------------------------------------------------------ */}
      {/* Footer                                                       */}
      {/* ------------------------------------------------------------ */}
      <footer className="border-t border-white/5">
        <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-10 px-6 py-14 md:grid-cols-3 lg:px-12">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2.5">
              <LogoMark />
              <span className="text-base font-extrabold tracking-tight text-white">
                Audio<span className="text-cyan-400">Repeat</span>
              </span>
            </div>
            <p className="mt-4 max-w-xs text-[13px] leading-relaxed text-slate-400">
              Hands-free audio drilling for auditory learners in {langCount} languages.
            </p>
          </div>

          {/* Product links — only pages/sections that actually exist */}
          <div>
            <h4 className="text-[11px] font-bold uppercase tracking-[0.2em] text-cyan-400">Product</h4>
            <ul className="mt-4 space-y-2.5">
              <li>
                <a href="#features" className="text-[13px] text-slate-400 transition hover:text-white">Features</a>
              </li>
              <li>
                <a href="#languages" className="text-[13px] text-slate-400 transition hover:text-white">Languages</a>
              </li>
              <li>
                <a href="#pricing" className="text-[13px] text-slate-400 transition hover:text-white">Pricing</a>
              </li>
            </ul>
          </div>

          {/* Newsletter */}
          <div>
            <h4 className="text-[11px] font-bold uppercase tracking-[0.2em] text-cyan-400">Join Newsletter</h4>
            <p className="mt-4 text-[13px] leading-relaxed text-slate-400">
              Weekly language-learning tips, zero spam.
            </p>
            <NewsletterForm />
          </div>
        </div>

        <div className="border-t border-white/5">
          <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 px-6 py-7 sm:flex-row lg:px-12">
            <p className="text-xs text-slate-500">© 2026 AudioRepeat · Loop, repeat, retain.</p>
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-slate-500">
              <a href="#features" className="transition hover:text-cyan-300">Features</a>
              <a href="#languages" className="transition hover:text-cyan-300">Languages</a>
              <Link href="/dashboard" className="transition hover:text-cyan-300">Practice</Link>
            </div>
          </div>
          <div className="border-t border-white/5">
            <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-center gap-x-6 gap-y-2 px-6 py-4 lg:px-12">
              <Link href="/privacy" className="text-xs text-slate-500 transition hover:text-cyan-300">Privacy Policy</Link>
              <span aria-hidden className="text-slate-700">·</span>
              <Link href="/terms" className="text-xs text-slate-500 transition hover:text-cyan-300">Terms</Link>
              <span aria-hidden className="text-slate-700">·</span>
              <Link href="/refunds" className="text-xs text-slate-500 transition hover:text-cyan-300">Refund Policy</Link>
            </div>
          </div>
        </div>
      </footer>

      {/* Reuses the existing Firebase sign-in flow (same overlay the in-app
          profile menu opens). Guests keep browsing; after sign-in the navbar
          action switches to Dashboard. */}
      {showAuth && <AuthScreen mode="overlay" onClose={() => setShowAuth(false)} />}
    </div>
  );
}
