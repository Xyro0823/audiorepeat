import SetLibrary from "@/components/library/SetLibrary";
import Hero from "@/components/Hero";

export default function DashboardPage() {
  return (
    <>
      {/* Cinematic HLS video hero at the top of the practice dashboard. */}
      <div id="hero" className="relative bg-black">
        <Hero />
        {/* Soft theme-aware fade from the hero into the page background —
            replaces the hard black edge (night-950 is the page background in
            both themes, so the hero melts into the dashboard below). A taller,
            gentler ramp so the hero eases out rather than ending abruptly. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 z-[2] h-24 bg-gradient-to-b from-transparent to-night-950"
        />
      </div>
      <SetLibrary />
    </>
  );
}
