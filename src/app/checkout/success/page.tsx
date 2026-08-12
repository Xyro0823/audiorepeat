import type { Metadata } from "next";
import SuccessView from "@/components/checkout/SuccessView";
import { isStripeConfigured, verifyCheckoutSession } from "@/lib/stripe/server";

export const metadata: Metadata = {
  title: "Checkout",
};

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { session_id } = await searchParams;

  // Server-side verification: only a paid session with known metadata counts
  // as a completed purchase. Anything else falls back to a generic message.
  let verified: { planId: string; billing: string; email?: string } | null = null;
  if (session_id && isStripeConfigured()) {
    try {
      verified = await verifyCheckoutSession(session_id);
    } catch (err) {
      console.error("[checkout] session verify failed:", err);
    }
  }

  return (
    <SuccessView
      planId={verified?.planId ?? null}
      billing={verified?.billing ?? 'annual'}
      email={verified?.email}
    />
  );
}
