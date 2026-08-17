import type { Metadata } from "next";
import LegalShell from "@/components/legal/LegalShell";
import { LEGAL_IDENTITY } from "@/lib/legalIdentity";

export const metadata: Metadata = {
  title: "Terms & Conditions",
  description:
    "The terms that govern your use of AudioRepeat.",
};

export default function TermsPage() {
  return (
    <LegalShell title="Terms & Conditions" updated="August 17, 2026">
      <section>
        <h2 className="text-lg font-semibold text-white">
          1. The service
        </h2>
        <p>
          AudioRepeat is a language-learning web app that plays vocabulary in
          your target language alongside its translation, with features such as
          spaced repetition, speed challenges, offline audio, and topic
          libraries. By creating an account or using AudioRepeat, you agree to
          these Terms.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-white">
          2. Eligibility and your account
        </h2>
        <p>
          You must be at least 13 years old to use AudioRepeat. You are
          responsible for keeping your account credentials safe and for all
          activity that happens under your account.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-white">3. Acceptable use</h2>
        <p>
          Use AudioRepeat for lawful, personal language learning. You may not
          misuse the service, attempt to disrupt it, bypass its security or
          access controls, or use it in a way that harms others.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-white">4. Plans and billing</h2>
        <p>
          AudioRepeat offers a Free plan, a Pro subscription, and a Lifetime
          plan:
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong className="text-white">Free</strong> — includes one
            language at no cost.
          </li>
          <li>
            <strong className="text-white">Pro Monthly</strong> — $4.99 per
            month, billed monthly until canceled.
          </li>
          <li>
            <strong className="text-white">Pro Annual</strong> — $39.99 per
            year, billed yearly until canceled.
          </li>
          <li>
            <strong className="text-white">Lifetime</strong> — $79.99 one-time
            payment for ongoing access while AudioRepeat continues to be
            offered.
          </li>
        </ul>
        <p className="mt-3">
          Paid subscriptions renew automatically at the end of each billing
          period until you cancel. You can cancel at any time; cancellation
          takes effect at the end of your current billing period, and you keep
          access until then.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-white">5. Refunds</h2>
        <p>
          Refund requests are handled according to our Refund Policy, which is
          part of these Terms. Your statutory rights are not affected.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-white">6. User content</h2>
        <p>
          Vocabulary sets you create or import (including subtitles you import)
          belong to you, and you are responsible for them. You may only import
          content you have the right to use.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-white">7. Availability</h2>
        <p>
          We work to keep AudioRepeat reliable, but we do not guarantee that
          the service will be uninterrupted or error-free. We may change,
          update, or discontinue features over time.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-white">
          8. Intellectual property
        </h2>
        <p>
          The AudioRepeat app, brand, and built-in content (including curated
          vocabulary and topic libraries) are owned by Evoq, the operator of
          AudioRepeat. Your use of the service does not transfer ownership of
          any of it.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-white">
          9. Disclaimer and limitation of liability
        </h2>
        <p>
          AudioRepeat is provided &ldquo;as is&rdquo; without warranties of any
          kind, to the extent permitted by law. To the maximum extent permitted
          by law, AudioRepeat is not liable for indirect, incidental, or
          consequential damages arising from your use of the service.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-white">10. Termination</h2>
        <p>
          You can stop using AudioRepeat at any time and delete your account
          from the app. We may suspend or terminate access for violations of
          these Terms or conduct that harms the service or other users.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-white">
          11. Changes to these terms
        </h2>
        <p>
          We may update these Terms from time to time. Continued use of
          AudioRepeat after changes take effect means you accept the updated
          Terms.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-white">12. Governing law</h2>
        <p>
          These Terms are governed by the laws of{" "}
          {LEGAL_IDENTITY.governingLaw}, without regard to conflict-of-law
          rules. If you are a consumer in a jurisdiction with mandatory
          protections, those protections continue to apply.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-white">13. Contact</h2>
        <p>
          Questions about these Terms? Contact {LEGAL_IDENTITY.legalName}, the
          operator of {LEGAL_IDENTITY.operator}, at{" "}
          <a
            href={`mailto:${LEGAL_IDENTITY.supportEmail}`}
            className="text-cyan-300 underline decoration-cyan-300/40 underline-offset-2 transition hover:text-cyan-200"
          >
            {LEGAL_IDENTITY.supportEmail}
          </a>
          .
        </p>
      </section>
    </LegalShell>
  );
}
