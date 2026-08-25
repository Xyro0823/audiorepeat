import { registerRoute } from "@/lib/i18n/register/route";
registerRoute("checkout");
import type { Metadata } from "next";
import CheckoutFlow from "@/components/checkout/CheckoutFlow";

export const metadata: Metadata = {
  title: "Checkout",
};

// Payment state must never be cached — the page is force-dynamic (never
// prerendered; Next emits Cache-Control: no-cache,no-store for dynamic
// pages) and the service worker treats /checkout as network-only.
export const dynamic = "force-dynamic";

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string; canceled?: string }>;
}) {
  // Landing-page pricing CTAs link here with ?plan=basic|pro|lifetime.
  // An invalid/missing value is handled inside the flow (defaults to Pro,
  // all three plans shown for selection). Stripe returns here with
  // ?canceled=1 when the user backs out of the payment page.
  const { plan, canceled } = await searchParams;
  return <CheckoutFlow initialPlan={plan} canceled={canceled === "1"} />;
}
