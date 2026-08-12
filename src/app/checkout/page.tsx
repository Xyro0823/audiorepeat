import type { Metadata } from "next";
import CheckoutFlow from "@/components/checkout/CheckoutFlow";

export const metadata: Metadata = {
  title: "Checkout",
};

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string }>;
}) {
  // Landing-page pricing CTAs link here with ?plan=basic|pro|lifetime.
  // An invalid/missing value is handled inside the flow (defaults to Pro,
  // all three plans shown for selection).
  const { plan } = await searchParams;
  return <CheckoutFlow initialPlan={plan} />;
}
