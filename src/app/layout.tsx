import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import {
  Barlow,
  Geist,
  Geist_Mono,
  Instrument_Serif,
  Inter,
  Plus_Jakarta_Sans,
} from "next/font/google";
import "./globals.css";
import AuthGate from "@/components/auth/AuthGate";
import OnboardingFlow from "@/components/onboarding/OnboardingFlow";
import InstallPrompt from "@/components/pwa/InstallPrompt";
import SwRegister from "@/components/pwa/SwRegister";
import ThemeManager from "@/components/settings/ThemeManager";
import UiLangGate from "@/components/settings/UiLangGate";
import { SITE_URL } from "@/lib/site";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Hero landing-section fonts — self-hosted via next/font so the PWA stays
// offline-capable. Exposed as CSS vars consumed by @theme tokens
// --font-heading / --font-body in globals.css.
const barlow = Barlow({
  variable: "--font-barlow",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
});

// Landing-page fonts — Plus Jakarta Sans for headlines, Inter for the UI
// precision body. Exposed as CSS vars consumed by the --font-display /
// --font-ui theme tokens in globals.css (scoped to the #landing section).
const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "AudioRepeat — Hands-Free Language Practice",
    template: "%s · AudioRepeat",
  },
  description:
    "Offline-first, hands-free vocabulary looping for auditory language learners. Hear each word repeated in your target language, then its translation.",
  applicationName: "AudioRepeat",
  alternates: {
    canonical: "/",
  },
  keywords: [
    "language learning",
    "audio vocabulary",
    "spaced repetition",
    "offline language practice",
    "hands-free learning",
  ],
  openGraph: {
    type: "website",
    url: "/",
    siteName: "AudioRepeat",
    title: "AudioRepeat — Hands-Free Language Practice",
    description: "Loop, repeat and retain vocabulary with device speech voices, spaced repetition and offline-ready practice.",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "AudioRepeat hands-free language practice" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "AudioRepeat — Hands-Free Language Practice",
    description: "Loop, repeat and retain vocabulary with device speech voices, spaced repetition and offline-ready practice.",
    images: ["/opengraph-image"],
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: "/icon.svg",
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    title: "AudioRepeat",
    statusBarStyle: "black-translucent",
  },
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#05050c",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // suppressHydrationWarning: browser extensions (e.g. CRXLauncher) inject
    // attributes like crxlauncher="" onto <html> after SSR, which React flags
    // as an attribute mismatch. This silences that element-level noise only.
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${barlow.variable} ${instrumentSerif.variable} ${plusJakarta.variable} ${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AuthGate>{children}</AuthGate>
        {/* First-time onboarding — self-gates per account; covers every route
            including the public landing page (a fresh account signs up there). */}
        <OnboardingFlow />
        <ThemeManager />
        <UiLangGate />
        <SwRegister />
        <InstallPrompt />
      </body>
    </html>
  );
}
