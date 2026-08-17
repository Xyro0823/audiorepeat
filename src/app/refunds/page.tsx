import type { Metadata } from "next";
import LegalShell from "@/components/legal/LegalShell";
import { LEGAL_IDENTITY } from "@/lib/legalIdentity";

export const metadata: Metadata = {
  title: "Refund Policy",
  description:
    "How cancellations and refunds work for AudioRepeat subscriptions and Lifetime purchases.",
};

export default function RefundsPage() {
  return (
    <LegalShell title="Refund Policy" updated="August 17, 2026">
      <section>
        <h2 className="text-lg font-semibold text-white">Overview</h2>
        <p>
          This policy explains how cancellations and refunds work for
          AudioRepeat purchases. Payments are processed by Paddle, our payment
          provider. Nothing here limits your statutory rights under applicable
          consumer law.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-white">Subscriptions</h2>
        <p>
          Pro subscriptions (monthly or annual) renew automatically until you
          cancel. You can cancel at any time from your account; cancellation
          stops future charges and you keep access until the end of the billing
          period you already paid for.
        </p>
        <p className="mt-3">
          If you believe a charge was made in error, or you are not satisfied
          with a recent renewal, contact us and we will review a refund
          request. We aim to handle these requests fairly and promptly.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-white">Lifetime purchases</h2>
        <p>
          Lifetime is a one-time purchase for ongoing access while AudioRepeat
          continues to be offered. If you believe you purchased Lifetime by
          mistake or are not satisfied, contact us and we will review a refund
          request on a case-by-case basis.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-white">
          Duplicate or incorrect charges
        </h2>
        <p>
          If you were charged twice for the same plan, or charged the wrong
          amount, contact us with the details and we will correct it, including
          a refund of any overcharge.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-white">
          Consumer rights
        </h2>
        <p>
          Where consumer-protection law applies to your purchase — for example,
          the withdrawal rights available to consumers in the European Union —
          those rights are not affected by this policy. Paddle may act as the
          merchant of record for purchases, and handles the payment processing
          on our behalf.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-white">How to request a refund</h2>
        <p>
          Contact {LEGAL_IDENTITY.legalName}, the operator of{" "}
          {LEGAL_IDENTITY.operator}, at{" "}
          <a
            href={`mailto:${LEGAL_IDENTITY.supportEmail}`}
            className="text-cyan-300 underline decoration-cyan-300/40 underline-offset-2 transition hover:text-cyan-200"
          >
            {LEGAL_IDENTITY.supportEmail}
          </a>{" "}
          with the email address used for the purchase and the plan involved.
          We will confirm receipt and respond within a reasonable time.
        </p>
      </section>
    </LegalShell>
  );
}
