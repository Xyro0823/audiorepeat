import type { Metadata } from "next";
import CheckoutFlow from "@/components/checkout/CheckoutFlow";

export const metadata: Metadata = {
  title: "Checkout",
};

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
  return <CheckoutFlow initialPlan={plan} canceled={canceled === '1'} />;
}
