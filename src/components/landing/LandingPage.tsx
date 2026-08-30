"use client";
import { registerRoute } from "@/lib/i18n/register/route";
registerRoute("landing");


import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore, type RefObject } from "react";
import { getSettingsSnapshot, subscribeSettings } from "@/lib/settingsStore";
import {
  ArrowUpRight,
  Download,
  Headphones,
  Languages,
  Mic,
  Repeat,
  ShieldCheck,
  Smartphone,
  WifiOff,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { setUiLang, useT, type TKey, UI_LANGUAGES } from "@/lib/i18n";
import { PlanText } from "@/lib/i18n/PlanText";
import { FREE_LANG_OPTIONS, SUPPORTED_LANGUAGE_COUNT } from "@/lib/freeLang";
import { landingAuthAction } from "@/lib/adminNav";
import { PLAN_ORDER, PLANS } from "@/lib/plans";
import { LEGAL_IDENTITY } from "@/lib/legalIdentity";
import InstallAppButton from "@/components/pwa/InstallAppButton";
import { ANNUAL_SAVINGS_PERCENT, FAQ_ITEMS, HOW_IT_WORKS } from "./landingContent";
import NewsletterForm from "./NewsletterForm";

// These panels are never part of the first view. Keeping their audio and
// authentication code out of the critical bundle lets the hero render sooner.
const AuthScreen = dynamic(() => import("@/components/auth/AuthScreen"), { ssr: false });
const AudioDemo = dynamic(() => import("./AudioDemo"), { ssr: false });

/* ------------------------------------------------------------------ */
/* Shared bits                                                        */
/* ------------------------------------------------------------------ */

/**
 * Display-layer localization of the canonical plan copy from lib/plans.
 * Names, prices and entitlements stay untouched — only the rendered bullet
 * and note text is routed through the dictionary. Returns null for unknown
 * strings so the canonical English always stands.
 */


const NAV_LINKS = [
  { href: "#how-it-works", labelKey: "landing.nav.how" },
  { href: "#demo", labelKey: "landing.nav.demo" },
  { href: "#features", labelKey: "landing.nav.features" },
  { href: "#pricing", labelKey: "landing.nav.pricing" },
  { href: "#faq", labelKey: "landing.nav.faq" },
] as const;

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

/** Truthful product-status pill; never presents synthetic live-user counts. */
function TrustPill() {
  const t = useT();
  return (
    <span className="inline-flex flex-wrap items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-center backdrop-blur-xl">
      <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" aria-hidden />
      <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-400">{t('landing.trust.title')}</span>
      <span className="text-xs text-white">{t('landing.trust.body')}</span>
    </span>
  );
}

/** Compact EN / МН interface-language toggle — works before any sign-in. */
function UiLangToggle() {
  const t = useT();
  const lang = useSyncExternalStore(
    subscribeSettings,
    () => (getSettingsSnapshot().uiLang === 'mn' ? 'mn' : 'en'),
    () => 'en' as const,
  );
  return (
    <div
      role="group"
      aria-label={t('landing.nav.uiLangAria')}
      className="inline-flex items-center rounded-full border border-white/15 bg-white/[0.04] p-0.5"
    >
      {UI_LANGUAGES.map((option) => (
        <button
          key={option.code}
          type="button"
          aria-pressed={lang === option.code}
          onClick={() => setUiLang(option.code)}
          className={`min-h-8 rounded-full px-2.5 py-1 text-[11px] font-bold transition-colors ${
            lang === option.code
              ? "bg-white text-black shadow-sm"
              : "text-slate-300 hover:text-white"
          }`}
        >
          {option.code === 'en' ? 'EN' : 'МН'}
        </button>
      ))}
    </div>
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
    // The decorative connection graph is hidden below the lg breakpoint.
    // Avoid forcing a hero layout measurement during the mobile LCP path.
    const desktopMedia = window.matchMedia("(min-width: 1024px)");
    const measure = () => {
      if (!desktopMedia.matches) return;
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
    desktopMedia.addEventListener("change", measure);
    // Re-measure once fonts/layout settle.
    const t = window.setTimeout(measure, 400);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
      desktopMedia.removeEventListener("change", measure);
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
  const router = useRouter();
  const t = useT();
  const uiLang = useSyncExternalStore(
    subscribeSettings,
    () => (getSettingsSnapshot().uiLang === 'mn' ? 'mn' : 'en'),
    () => 'en' as const,
  );
  const [showAuth, setShowAuth] = useState(false);
  useEffect(() => {
    if (status === 'signed-in') router.replace('/dashboard');
  }, [router, status]);
  const landingAction = landingAuthAction(status);
  const langCount = SUPPORTED_LANGUAGE_COUNT;
  const fullPackCount = FREE_LANG_OPTIONS.filter((option) => option.hasFullPack).length;
  const heroRef = useRef<HTMLDivElement | null>(null);
  const nodeRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  // These are deliberately component-level rather than document-level CSS:
  // the landing page can react immediately to the language picker, including
  // while persisted settings are still hydrating.
  const heroHeadingClass = uiLang === 'mn'
    ? 'mx-auto mt-5 max-w-2xl text-balance text-3xl font-extrabold leading-[1.1] tracking-tight text-white sm:text-4xl lg:text-5xl'
    : 'mx-auto mt-5 max-w-3xl text-balance text-3xl font-extrabold leading-tight tracking-tight text-white md:text-5xl lg:text-6xl';
  const sectionHeadingClass = uiLang === 'mn'
    ? 'mx-auto mt-3 max-w-3xl text-balance text-3xl font-extrabold leading-[1.14] tracking-tight text-white sm:text-4xl lg:text-[2.75rem]'
    : 'mt-3 text-balance text-4xl font-extrabold tracking-tight text-white md:text-5xl';
  const noMarginSectionHeadingClass = uiLang === 'mn'
    ? 'mx-auto max-w-3xl text-balance text-3xl font-extrabold leading-[1.14] tracking-tight text-white sm:text-4xl lg:text-[2.75rem]'
    : 'text-4xl font-extrabold tracking-tight text-white md:text-5xl';
  const compactHeadingClass = uiLang === 'mn'
    ? 'mt-3 max-w-2xl text-balance text-3xl font-extrabold leading-[1.14] tracking-tight text-white sm:text-4xl'
    : 'mt-3 text-balance text-3xl font-extrabold tracking-tight text-white md:text-4xl';

  // Single source of pricing truth (shared with /checkout) — the shape below
  // keeps the pricing JSX unchanged while prices live in src/lib/plans.ts.
  const plans = PLAN_ORDER.map((id) => {
    const p = PLANS[id];
    const { price, note } = p.priceFor(annual);
    return {
      name: p.name,
      taglineKey: `landing.plan.${id}.tagline` as TKey,
      plan: id,
      price,
      monthlyNote: note,
      features: p.features(langCount),
      ctaKey: `landing.plan.${id}.cta` as TKey,
      popular: p.popular,
    };
  });

  const features = [
    {
      icon: Repeat,
      titleKey: "landing.features.item1.title",
      textKey: "landing.features.item1.text",
    },
    {
      icon: WifiOff,
      titleKey: "landing.features.item2.title",
      textKey: "landing.features.item2.text",
    },
    {
      icon: Mic,
      titleKey: "landing.features.item3.title",
      textKey: "landing.features.item3.text",
    },
    {
      icon: Languages,
      titleKey: "landing.features.item4.title",
      textKey: "landing.features.item4.text",
    },
  ] as const;

  return (
    <div id="landing" className="relative min-h-screen overflow-x-clip bg-[#0a0a0a] text-[#e8eaef]">
      <a
        href="#main-content"
        className="fixed left-4 top-3 z-[60] -translate-y-20 rounded-full bg-white px-4 py-2 text-sm font-semibold text-black transition-transform focus:translate-y-0 focus:outline-none focus:ring-2 focus:ring-cyan-300"
      >
        {t('landing.nav.skip')}
      </a>
      {/* Ambient background: dot grid + cyan radials */}
      <div className="pointer-events-none fixed inset-0" aria-hidden>
        <div className="bg-dots absolute inset-0" />
        <div className="absolute inset-0 bg-[radial-gradient(1000px_620px_at_72%_-12%,rgba(6,182,212,0.12),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(900px_540px_at_8%_112%,rgba(59,130,246,0.1),transparent_60%)]" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent" />
      </div>

      {/* Fixed top navbar */}
      <nav className="fixed inset-x-0 top-0 z-50 border-b border-white/5 bg-[#0a0a0a]/70 backdrop-blur-xl">
        <div className="mx-auto flex min-h-16 w-full max-w-6xl items-center justify-between gap-3 px-4 py-2 sm:gap-4 sm:px-6 lg:px-12">
          <Link href="/" aria-label={t('landing.nav.home')} className="flex min-h-11 items-center gap-2.5 rounded-xl">
            <LogoMark />
            {/* Wordmark hidden on ultra-narrow screens so the logo mark +
                Sign in + Start Practice always fit without overflow. */}
            <span className="hidden text-lg font-extrabold tracking-tight text-white sm:inline">
              Audio<span className="text-cyan-400">Repeat</span>
            </span>
          </Link>

          <div className="hidden items-center gap-5 xl:flex">
            {NAV_LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-400 transition-colors hover:text-cyan-300"
              >
                {t(l.labelKey)}
              </a>
            ))}
          </div>

          {/* Auth-aware secondary action: Sign in (signed out) / Dashboard
              (signed in). Hidden while auth is loading so the wrong state
              never flashes; the primary CTA is always Start Practice. */}
          <div className="flex items-center gap-2.5">
            <UiLangToggle />
            {landingAction?.kind === 'link' ? (
              <Link
                href={landingAction.href}
                className="inline-flex min-h-11 items-center rounded-full border border-white/20 bg-white/5 px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-white/10 active:scale-95"
              >
                {t('landing.nav.dashboard')}
              </Link>
            ) : landingAction?.kind === 'auth' ? (
              <button
                type="button"
                onClick={() => setShowAuth(true)}
                className="inline-flex min-h-11 items-center rounded-full border border-white/20 bg-white/5 px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-white/10 active:scale-95"
              >
                {t('landing.nav.signIn')}
              </button>
            ) : null}
            <Link
              href="/dashboard"
              className="inline-flex min-h-11 items-center rounded-full bg-white px-5 py-2 text-[13px] font-semibold text-black shadow-[0_4px_20px_rgba(255,255,255,0.15)] transition hover:bg-slate-100 active:scale-95"
            >
              {t('landing.nav.startPractice')}
            </Link>
          </div>
        </div>
      </nav>

      <main id="main-content">

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
                {t('landing.hero.badge')}
              </p>

              <h1 className={heroHeadingClass}>
                {t('landing.hero.titlePrefix')}{" "}
                <span className="bg-gradient-to-r from-[#22d3ee] via-[#06b6d4] to-[#3b82f6] bg-clip-text text-transparent">
                  {t('landing.hero.titleAccent')}
                </span>
              </h1>

              <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-slate-400 md:text-[15px]">
                {t('landing.hero.subtitle', { count: langCount })}
              </p>

              <div className="mt-7 flex flex-wrap items-center justify-center gap-4">
                <Link
                  href="/dashboard"
                  className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 px-6 py-3 font-semibold text-white shadow-lg shadow-cyan-500/20 transition hover:brightness-110 active:scale-95"
                >
                  {t('landing.hero.ctaPrimary')}
                  <ArrowUpRight className="h-4 w-4" aria-hidden />
                </Link>
                <Link
                  href="/dashboard#vocab-grid"
                  className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-6 py-3 font-semibold text-white transition hover:bg-white/10 active:scale-95"
                >
                  {t('landing.hero.ctaSecondary')}
                </Link>
              </div>

              <p className="mt-5 text-[11px] uppercase tracking-[0.2em] text-slate-400">
                {t('landing.hero.tagline')}
              </p>
              <ol className="mx-auto mt-6 grid max-w-2xl gap-2 text-left sm:grid-cols-3" aria-label={t('landing.how.kicker')}>
                {["pick", "listen", "return"].map((step, index) => (
                  <li key={step} className="flex min-h-11 items-center gap-2 rounded-xl border border-white/[0.08] bg-black/15 px-3 text-xs text-slate-300">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-cyan-400/15 text-[10px] font-bold text-cyan-200">{index + 1}</span>
                    {t(`landing.hero.loop.${step}` as TKey)}
                  </li>
                ))}
              </ol>
            </div>

            {/* Product transparency pill under the node */}
            <div className="mt-5 flex justify-center">
              <TrustPill />
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

      {/* The sections below the hero stay in the HTML for links and search,
          but the browser can skip their expensive layout until they approach
          the viewport. This keeps the first paint focused on the LCP hero. */}
      <div style={{ contentVisibility: "auto", containIntrinsicSize: "auto 5200px" }}>
      {/* ------------------------------------------------------------ */}
      {/* How it works                                                  */}
      {/* ------------------------------------------------------------ */}
      <section id="how-it-works" className="mx-auto w-full max-w-6xl scroll-mt-28 px-6 pb-24 pt-28 lg:px-12">
        <div className="text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-400">{t('landing.how.kicker')}</p>
          <h2 className={sectionHeadingClass}>
            {t('landing.how.title')}
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-slate-400">
            {t('landing.how.sub')}
          </p>
        </div>
        <ol className="mt-12 grid grid-cols-1 gap-5 lg:grid-cols-3">
          {HOW_IT_WORKS.map((item) => (
            <li key={item.step} className="glass-neural rounded-3xl p-6">
              <span className="font-mono text-xs font-bold tracking-[0.2em] text-cyan-400">{item.step}</span>
              <h3 className="mt-5 text-xl font-bold text-white">{t(item.titleKey)}</h3>
              <p className="mt-3 text-sm leading-relaxed text-slate-400">{t(item.textKey)}</p>
            </li>
          ))}
        </ol>
      </section>

      <AudioDemo />

      {/* ------------------------------------------------------------ */}
      {/* Features grid                                               */}
      {/* ------------------------------------------------------------ */}
      <section id="features" className="mx-auto w-full max-w-6xl scroll-mt-28 px-6 pb-24 pt-28 lg:px-12">
        <div className="text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-400">{t('landing.features.kicker')}</p>
          <h2 className={sectionHeadingClass}>
            {t('landing.features.title')}
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-slate-400">
            {t('landing.features.sub')}
          </p>
        </div>

        <div className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f, i) => (
            <div
              key={f.titleKey}
              className="glass-neural group rounded-3xl p-6 hover:-translate-y-1 hover:border-cyan-400/40"
              style={{ animationDelay: `${i * 90}ms` }}
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#06b6d4]/10 transition-transform duration-300 group-hover:scale-110">
                <f.icon className="h-6 w-6 text-[#22d3ee]" aria-hidden />
              </div>
              <h3 className="mt-4 text-xl font-bold text-white">{t(f.titleKey)}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">{t(f.textKey)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------ */}
      {/* Languages                                                     */}
      {/* ------------------------------------------------------------ */}
      <section id="languages" className="mx-auto w-full max-w-6xl scroll-mt-28 px-6 pb-28 lg:px-12">
        <div className="glass-neural rounded-[2rem] p-8 text-center md:p-12">
          <h2 className={noMarginSectionHeadingClass}>
            {t('landing.languages.titlePrefix', { count: langCount })}{" "}
            <span className="bg-gradient-to-r from-[#22d3ee] to-[#3b82f6] bg-clip-text text-transparent">{t('landing.languages.titleAccent')}</span>
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-slate-400">
            {t('landing.languages.sub')}
          </p>
          <p className="mx-auto mt-3 max-w-xl text-xs leading-5 text-slate-400">
            {t('landing.languages.depth', { full: fullPackCount })}
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
            <span className="inline-flex items-center rounded-full px-3 py-1.5 text-[13px] font-medium text-slate-400">
              {t('landing.languages.more', { count: Math.max(0, langCount - 12) })}
            </span>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ */}
      {/* Installable app                                               */}
      {/* ------------------------------------------------------------ */}
      <section id="install" className="mx-auto w-full max-w-6xl scroll-mt-28 px-6 pb-28 lg:px-12">
        <div className="grid items-center gap-8 rounded-[2rem] border border-cyan-400/20 bg-gradient-to-br from-cyan-500/10 via-white/[0.035] to-blue-500/10 p-7 sm:p-9 lg:grid-cols-[1fr_auto] lg:p-12">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-400">{t('landing.install.kicker')}</p>
            <h2 className={compactHeadingClass}>
              {t('landing.install.title')}
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-slate-400">
              {t('landing.install.body')}
            </p>
            <ul className="mt-6 grid gap-3 text-sm text-slate-300 md:grid-cols-3">
              <li className="flex items-center gap-2"><Smartphone className="h-4 w-4 text-cyan-300" aria-hidden /> {t('landing.install.bullet1')}</li>
              <li className="flex items-center gap-2"><Download className="h-4 w-4 text-cyan-300" aria-hidden /> {t('landing.install.bullet2')}</li>
              <li className="flex items-center gap-2"><Headphones className="h-4 w-4 text-cyan-300" aria-hidden /> {t('landing.install.bullet3')}</li>
            </ul>
          </div>
          <div className="flex flex-col items-stretch gap-3 sm:items-start lg:items-end">
            <InstallAppButton variant="landing" />
            <Link href="/dashboard" className="text-center text-xs font-semibold text-slate-400 underline decoration-white/20 underline-offset-4 transition-colors hover:text-white">
              {t('landing.install.openWithout')}
            </Link>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ */}
      {/* Pricing                                                      */}
      {/* ------------------------------------------------------------ */}
      <section id="pricing" className="mx-auto w-full max-w-6xl scroll-mt-28 px-6 pb-28 lg:px-12">
        <div className="text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-400">{t('landing.pricing.kicker')}</p>
          <h2 className={sectionHeadingClass}>
            {t('landing.pricing.title')}
          </h2>

          {/* monthly / annual toggle */}
          <div className="mt-8 inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] p-1" role="group" aria-label={t('landing.pricing.billingAria')}>
            <button
              type="button"
              aria-pressed={!annual}
              onClick={() => setAnnual(false)}
              className={`rounded-full px-5 py-2 text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 ${
                !annual ? "bg-white text-black shadow" : "text-slate-400 hover:text-white"
              }`}
            >
              {t('landing.pricing.monthly')}
            </button>
            <button
              type="button"
              aria-pressed={annual}
              onClick={() => setAnnual(true)}
              className={`rounded-full px-5 py-2 text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 ${
                annual ? "bg-white text-black shadow" : "text-slate-400 hover:text-white"
              }`}
            >
              {t('landing.pricing.annual')} <span className={`ml-1 text-[10px] font-bold ${annual ? "text-emerald-700" : "text-emerald-400"}`}>{t('landing.pricing.save', { percent: ANNUAL_SAVINGS_PERCENT })}</span>
            </button>
          </div>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-6 lg:grid-cols-3">
          {plans.map((p) => (
            <div
              key={p.name}
              className={`glass-neural relative flex flex-col rounded-[2rem] p-8 ${
                p.popular
                  ? "border-cyan-400/50 shadow-[0_0_60px_rgba(6,182,212,0.15)] lg:-mt-4 lg:mb-4"
                  : ""
              }`}
            >
              {p.popular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-[#06b6d4] to-[#3b82f6] px-4 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-white shadow-[0_0_20px_rgba(6,182,212,0.5)]">
                  {t('landing.pricing.mostPopular')}
                </span>
              )}
              <h3 className="text-lg font-bold text-white">{p.name}</h3>
              <p className="mt-1 text-[13px] text-slate-400">{t(p.taglineKey)}</p>
              <div className="mt-6 flex items-end gap-2">
                <span className="text-5xl font-extrabold tracking-tight text-white">
                  ${p.price}
                </span>
                <span className="pb-1.5 text-xs text-slate-400"><PlanText text={p.monthlyNote} /></span>
              </div>
              <ul className="mt-7 space-y-3">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-slate-300">
                    <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-cyan-500/15">
                      <svg viewBox="0 0 24 24" className="h-2.5 w-2.5 text-cyan-300" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d="m5 13 4 4L19 7" />
                      </svg>
                    </span>
                    <PlanText text={f} />
                  </li>
                ))}
              </ul>
              <Link
                href={`/checkout?plan=${p.plan}`}
                className={`mt-8 inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold transition ${
                  p.popular ? "btn-neural" : "glass-neural text-white hover:bg-white/[0.07]"
                }`}
              >
                {t(p.ctaKey)}
                <ArrowUpRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------ */}
      {/* Audio transparency                                            */}
      {/* ------------------------------------------------------------ */}
      <section className="mx-auto w-full max-w-6xl px-6 pb-28 lg:px-12">
        <div className="text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-400">{t('landing.audio.kicker')}</p>
          <h2 className={sectionHeadingClass}>
            {t('landing.audio.title')}
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-slate-400">
            {t('landing.audio.body')}
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-5 lg:grid-cols-3">
          {[
            { icon: Headphones, titleKey: "landing.audio.card1.title" as const, textKey: "landing.audio.card1.text" as const },
            { icon: Repeat, titleKey: "landing.audio.card2.title" as const, textKey: "landing.audio.card2.text" as const },
            { icon: ShieldCheck, titleKey: "landing.audio.card3.title" as const, textKey: "landing.audio.card3.text" as const },
          ].map((item) => (
            <div key={item.titleKey} className="glass-neural rounded-3xl p-6">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-300">
                <item.icon className="h-5 w-5" aria-hidden />
              </span>
              <h3 className="mt-5 text-lg font-bold text-white">{t(item.titleKey)}</h3>
              <p className="mt-3 text-sm leading-relaxed text-slate-400">{t(item.textKey)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------ */}
      {/* FAQ                                                           */}
      {/* ------------------------------------------------------------ */}
      <section id="faq" className="mx-auto w-full max-w-4xl scroll-mt-28 px-6 pb-28 lg:px-12">
        <div className="text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-400">{t('landing.faq.kicker')}</p>
          <h2 className={sectionHeadingClass}>
            {t('landing.faq.title')}
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-slate-400">
            {t('landing.faq.sub')}
          </p>
        </div>
        <div className="mt-10 space-y-3">
          {FAQ_ITEMS.map((item) => (
            <details key={item.questionKey} className="group rounded-2xl border border-white/10 bg-white/[0.035] px-5 py-1 open:border-cyan-400/25 open:bg-cyan-500/[0.055]">
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-3 text-left text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 sm:text-base">
                {t(item.questionKey)}
                <span aria-hidden className="text-xl font-light text-cyan-300 transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="max-w-3xl pb-5 pr-8 text-sm leading-relaxed text-slate-400">{t(item.answerKey)}</p>
            </details>
          ))}
        </div>
        <p className="mt-8 text-center text-sm text-slate-400">
          {t('landing.faq.helpPrefix')}{" "}
          <a href={`mailto:${LEGAL_IDENTITY.supportEmail}`} className="font-semibold text-cyan-300 underline decoration-cyan-300/40 underline-offset-4 hover:text-cyan-200">
            {t('landing.faq.contactSupport')}
          </a>
        </p>
      </section>
      </div>
      </main>

      {/* ------------------------------------------------------------ */}
      {/* Footer                                                       */}
      {/* ------------------------------------------------------------ */}
      <div style={{ contentVisibility: "auto", containIntrinsicSize: "auto 620px" }}>
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
              {t('landing.footer.blurb', { count: langCount })}
            </p>
          </div>

          {/* Product links — only pages/sections that actually exist */}
          <div>
            <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-cyan-400">{t('landing.footer.product')}</h3>
            <ul className="mt-4 space-y-2.5">
              <li>
                <a href="#how-it-works" className="text-[13px] text-slate-400 transition hover:text-white">{t('landing.footer.howItWorks')}</a>
              </li>
              <li>
                <a href="#demo" className="text-[13px] text-slate-400 transition hover:text-white">{t('landing.footer.audioDemo')}</a>
              </li>
              <li>
                <a href="#pricing" className="text-[13px] text-slate-400 transition hover:text-white">{t('landing.footer.pricing')}</a>
              </li>
              <li>
                <a href="#faq" className="text-[13px] text-slate-400 transition hover:text-white">{t('landing.footer.faq')}</a>
              </li>
              <li>
                <a href={`mailto:${LEGAL_IDENTITY.supportEmail}`} className="text-[13px] text-slate-400 transition hover:text-white">{t('landing.footer.contactSupport')}</a>
              </li>
            </ul>
          </div>

          {/* Newsletter */}
          <div>
            <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-cyan-400">{t('landing.footer.newsletter')}</h3>
            <p className="mt-4 text-[13px] leading-relaxed text-slate-400">
              {t('landing.footer.newsletterBlurb')}
            </p>
            <NewsletterForm />
          </div>
        </div>

        <div className="border-t border-white/5">
          <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 px-6 py-7 sm:flex-row lg:px-12">
            <p className="text-xs text-slate-400">{t('landing.footer.copyright')}</p>
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-slate-400">
              <a href="#demo" className="transition hover:text-cyan-300">{t('landing.footer.audioDemo')}</a>
              <a href="#install" className="transition hover:text-cyan-300">{t('landing.footer.install')}</a>
              <Link href="/dashboard" className="transition hover:text-cyan-300">{t('landing.footer.practice')}</Link>
            </div>
          </div>
          <div className="border-t border-white/5">
            <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-center gap-x-6 gap-y-2 px-6 py-4 lg:px-12">
              <Link href="/privacy" className="text-xs text-slate-400 transition hover:text-cyan-300">{t('landing.footer.privacy')}</Link>
              <span aria-hidden className="text-slate-700">·</span>
              <Link href="/terms" className="text-xs text-slate-400 transition hover:text-cyan-300">{t('landing.footer.terms')}</Link>
              <span aria-hidden className="text-slate-700">·</span>
              <Link href="/refunds" className="text-xs text-slate-400 transition hover:text-cyan-300">{t('landing.footer.refunds')}</Link>
              <span aria-hidden className="text-slate-700">·</span>
              <a href={`mailto:${LEGAL_IDENTITY.supportEmail}`} className="text-xs text-slate-400 transition hover:text-cyan-300">{t('landing.footer.support')}</a>
            </div>
          </div>
        </div>
      </footer>
      </div>

      {/* Reuses the existing Firebase sign-in flow (same overlay the in-app
          profile menu opens). Guests keep browsing; after sign-in the navbar
          action switches to Dashboard. */}
      {showAuth && <AuthScreen mode="overlay" onClose={() => setShowAuth(false)} />}
    </div>
  );
}
