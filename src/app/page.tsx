import SetLibrary from "@/components/library/SetLibrary";
import Hero from "@/components/Hero";

export default function HomePage() {
  return (
    <>
      {/* Cinematic HLS video hero at the very top of the page. */}
      <div id="hero" className="bg-black">
        <Hero />
      </div>
      <SetLibrary />
    </>
  );
}
