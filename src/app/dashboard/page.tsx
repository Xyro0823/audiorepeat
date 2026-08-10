import SetLibrary from "@/components/library/SetLibrary";
import Hero from "@/components/Hero";

export default function DashboardPage() {
  return (
    <>
      {/* Cinematic HLS video hero at the top of the practice dashboard. */}
      <div id="hero" className="bg-black">
        <Hero />
      </div>
      <SetLibrary />
    </>
  );
}
