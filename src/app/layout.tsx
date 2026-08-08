import type { Metadata, Viewport } from "next";
import { Barlow, Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import "./globals.css";
import AuthGate from "@/components/auth/AuthGate";
import InstallPrompt from "@/components/pwa/InstallPrompt";
import SwRegister from "@/components/pwa/SwRegister";
import ThemeManager from "@/components/settings/ThemeManager";

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

export const metadata: Metadata = {
  title: {
    default: "AudioRepeat",
    template: "%s · AudioRepeat",
  },
  description:
    "Offline-first, hands-free vocabulary looping for auditory language learners. Hear each word repeated in your target language, then its translation.",
  applicationName: "AudioRepeat",
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

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: browser extensions (e.g. CRXLauncher) inject
    // attributes like crxlauncher="" onto <html> after SSR, which React flags
    // as an attribute mismatch. This silences that element-level noise only.
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${barlow.variable} ${instrumentSerif.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AuthGate>{children}</AuthGate>
        <ThemeManager />
        <SwRegister />
        <InstallPrompt />
      </body>
    </html>
  );
}
