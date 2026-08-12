import SetLibrary from "@/components/library/SetLibrary";
import Hero from "@/components/Hero";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string }>;
}) {
  // The pricing CTAs on the landing page link here with ?plan=pro|basic|lifetime.
  // SetLibrary surfaces a small acknowledgment so the choice isn't silently
  // dropped (there is no real checkout flow yet).
  const { plan } = await searchParams;

  return (
    <>
      {/* Cinematic HLS video hero at the top of the practice dashboard. */}
      <div id="hero" className="bg-black">
        <Hero />
      </div>
      <SetLibrary initialPlan={plan} />
    </>
  );
}
