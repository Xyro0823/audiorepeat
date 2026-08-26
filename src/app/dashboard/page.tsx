import { registerRoute } from "@/lib/i18n/register/route";
registerRoute("dashboard");
import SetLibrary from "@/components/library/SetLibrary";
import Hero from "@/components/Hero";

export default function DashboardPage() {
  return (
    <>
      {/* The cinematic hero is useful on a wide dashboard, but it crowds out
          the mobile app's focused Home / Review / Library tabs. */}
      <div id="hero" className="relative hidden bg-[#05060a] md:block">
        <Hero />
        {/* Soft theme-aware fade from the hero into the page background —
            replaces the hard black edge (night-950 is the page background in
            both themes). Shorter than before: it only needs to ease the theme
            switch, so it no longer adds a long invisible dark band on top of
            the hero's own bottom fade. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 z-[2] h-20 bg-gradient-to-b from-transparent to-night-950"
        />
      </div>
      <SetLibrary />
    </>
  );
}
