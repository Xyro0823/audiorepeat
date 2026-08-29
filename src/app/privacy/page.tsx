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
            <strong className="text-white">Learning and sync data.</strong>{" "}
            Vocabulary sets, progress, streaks, and settings are stored locally
            in your browser&apos;s storage (IndexedDB/localStorage) so AudioRepeat
            works offline. If you sign in, your vocabulary sets and their
            Known/Review/FSRS progress are transmitted over encrypted HTTPS and
            stored in Firebase so they can sync across your devices. Guest
            libraries remain device-only.
          </li>
          <li>
            <strong className="text-white">Global leaderboard.</strong>{" "}
            Signed-in learners who record practice may appear on the weekly
            leaderboard using only their public account name, aggregate words
            listened, and aggregate listening time for that day. Vocabulary,
            translations, email addresses, and account IDs are never published
            in the leaderboard.
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
            <strong className="text-white">Error diagnostics.</strong> When the
            app has an unexpected technical error, we store only fixed categories
            such as the affected product area, standard error class, app release,
            connectivity state, and a non-identifying fingerprint. The diagnostic
            record never contains the error message, stack trace, page URL,
            vocabulary content, email, account identifier, IP address, token, or
            browser fingerprint.
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
          personally identifying value. Error diagnostics follow the same
          non-identifying design and never include user-created learning content.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-white">
          How we use information
        </h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>To operate your account and provide the service you signed up for.</li>
          <li>To sync a signed-in library and learning progress across devices.</li>
          <li>To show aggregate weekly practice rankings for signed-in learners.</li>
          <li>To process payments through Paddle and grant the correct plan.</li>
          <li>To send the newsletter only to people who subscribed to it.</li>
          <li>
            To understand and improve onboarding (aggregate analytics only).
          </li>
          <li>To find and fix unexpected app errors using sanitized diagnostics.</li>
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
            authentication, entitlements, and signed-in library sync storage.
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
          Guest learning data is kept on the device. Signed-in libraries and
          learning progress are also retained in Firebase for cross-device sync
          until the account is deleted. Other server-side records (account
          information, entitlements, newsletter subscriptions, aggregate
          analytics) are retained for as long as needed to operate the service
          and comply with legal obligations. Sanitized error diagnostics are
          assigned a 30-day expiry time. Because analytics and diagnostic events
          contain no account identifier, individual events cannot be linked back
          to — or individually deleted for — a specific account. Cloud-generated
          audio is stored in your browser cache and can be removed by clearing
          the site&apos;s stored data.
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
            removes your account, synced vocabulary/progress, and related
            account-linked server-side records.
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
