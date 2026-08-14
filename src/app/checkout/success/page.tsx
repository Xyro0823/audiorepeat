import type { Metadata } from "next";
import { headers } from "next/headers";
import SuccessView from "@/components/checkout/SuccessView";
import { isPaddleConfigured, verifyPaddleTransaction } from "@/lib/paddle/server";

export const metadata: Metadata = {
  title: "Checkout",
};

// Purchase state must never be cached — the success page is always rendered
// per request and marked no-store (the service worker treats /checkout/* as
// network-only).
export const dynamic = "force-dynamic";

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  // Paddle redirects here after a completed checkout with ?transaction_id=…
  // appended to the configured successUrl. (Display only — entitlement is
  // granted by the webhook and confirmed via /api/entitlement.)
  searchParams: Promise<{ transaction_id?: string }>;
}) {
  (await headers()).set("Cache-Control", "no-store");
  const { transaction_id } = await searchParams;

  // Server-side verification (display only): a completed transaction with a
  // known catalog price counts as a completed purchase for the confirmation
  // copy. This NEVER grants anything — the webhook → Firestore record is the
  // source of truth and the client polls /api/entitlement for the actual plan.
  let verified: { planId: string; billing: string; email?: string } | null = null;
  if (transaction_id && isPaddleConfigured()) {
    try {
      verified = await verifyPaddleTransaction(transaction_id);
    } catch (err) {
      console.error("[checkout] transaction verify failed:", err);
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
