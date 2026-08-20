import type { Metadata } from "next";
import LegalShell from "@/components/legal/LegalShell";
import { LEGAL_IDENTITY } from "@/lib/legalIdentity";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How AudioRepeat collects, uses, and protects your information.",
};

export default function PrivacyPage() {
  return (
    <LegalShell title="Privacy Policy" updated="August 20, 2026">
      <section>
        <h2 className="text-lg font-semibold text-white">Overview</h2>
        <p>
          AudioRepeat is a language-learning web app that plays vocabulary in
          your target language and its translation so you can learn by
          listening. The service is operated by Evoq. This policy explains what
          information AudioRepeat collects, why, and how you can control it.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-white">Information we collect</h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong className="text-white">Account information.</strong> If you
            create an account, Firebase Authentication stores your email address
            (and any display name you choose) so we can sync your plan
            entitlement and keep your data separate from other users.
          </li>
          <li>
            <strong className="text-white">Learning data on your device.</strong>{" "}
            Your vocabulary sets, progress, streaks, and settings are stored
            locally in your browser&apos;s storage (IndexedDB/localStorage) so
            AudioRepeat works offline. This data stays on your device except for
            the individual text sent for cloud speech when a device voice is unavailable.
          </li>
          <li>
            <strong className="text-white">Newsletter email.</strong> If you
            subscribe to the newsletter from the landing page, we store the
            email address you provide so we can send it to you.
          </li>
          <li>
            <strong className="text-white">Purchase information.</strong>{" "}
            Payments are processed by Paddle. AudioRepeat never sees or stores
            your card details — we only record which plan you purchased so we
            can grant access.
          </li>
          <li>
            <strong className="text-white">Onboarding analytics.</strong> We
            collect lightweight, aggregate analytics about the onboarding
            experience (language, level, goal, and which practice option you
            chose). These events do not contain your email, name, or account
            identifier.
          </li>
          <li>
            <strong className="text-white">Cloud speech text.</strong> When a
            compatible device voice is unavailable, the word or phrase being played
            is sent securely to Microsoft Azure Speech to generate audio. AudioRepeat
            caches the returned audio on your device for later and offline playback.
          </li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-white">
          What we do not collect
        </h2>
        <p>
          We do not collect card details, and we do not use advertising
          trackers, cookies for ad targeting, or fingerprinting. Our onboarding
          analytics intentionally stores no account identifier, email, or other
          personally identifying value.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-white">
          How we use information
        </h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>To operate your account and provide the service you signed up for.</li>
          <li>To process payments through Paddle and grant the correct plan.</li>
          <li>To send the newsletter only to people who subscribed to it.</li>
          <li>
            To understand and improve onboarding (aggregate analytics only).
          </li>
          <li>To generate spoken audio when your device has no compatible voice.</li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-white">
          Third-party services
        </h2>
        <p>
          AudioRepeat uses the following providers to operate the service:
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong className="text-white">Firebase</strong> (Google) —
            authentication and data storage.
          </li>
          <li>
            <strong className="text-white">Paddle</strong> — payment
            processing for paid plans.
          </li>
          <li>
            <strong className="text-white">Vercel</strong> — website hosting.
          </li>
          <li>
            <strong className="text-white">Microsoft Azure Speech</strong> —
            text-to-speech generation when a compatible device voice is unavailable.
          </li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-white">Storage and retention</h2>
        <p>
          Learning data is kept on your device. Server-side records (account
          information, entitlements, newsletter subscriptions, aggregate
          analytics) are retained for as long as needed to operate the service
          and comply with legal obligations. Because analytics events contain no
          account identifier, individual analytics events cannot be linked back
          to — or individually deleted for — a specific account. Cloud-generated
          audio is stored in your browser cache and can be removed by clearing the
          site&apos;s stored data.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-white">
          Your choices and deletion
        </h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong className="text-white">Delete your account.</strong> You can
            delete your account from the app (Settings → Delete account). This
            removes your account and related server-side records.
          </li>
          <li>
            <strong className="text-white">Local data.</strong> Your device
            data can be cleared by clearing your browser&apos;s site storage.
          </li>
          <li>
            <strong className="text-white">Newsletter.</strong> You can stop
            receiving the newsletter at any time; contact us and we will remove
            your address.
          </li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-white">Children</h2>
        <p>
          AudioRepeat is not directed at children under 13, and we do not
          knowingly collect personal information from children under 13.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-white">
          Changes to this policy
        </h2>
        <p>
          We may update this policy as the service evolves. Material changes
          will be reflected here with an updated &ldquo;Last updated&rdquo;
          date.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-white">Contact</h2>
        <p>
          Questions about privacy? Contact {LEGAL_IDENTITY.legalName}, the
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
