"use client";

import { useState, type FormEvent } from "react";
import { ArrowUpRight, Loader2 } from "lucide-react";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Firestore can retry an aborted write stream for a long time; bound it so
 *  the form always settles into the retry-able error state instead of an
 *  endless spinner. Normal writes complete in well under a second. */
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = window.setTimeout(() => reject(new Error("timeout")), ms);
    p.then(
      (v) => { window.clearTimeout(t); resolve(v); },
      (e) => { window.clearTimeout(t); reject(e); },
    );
  });
}

type Status = "idle" | "loading" | "success" | "error";

/**
 * Landing-page newsletter signup. Submits to Firestore via a lazy import of
 * the firebase newsletter module (SDK only loads on first submit). Handles
 * empty/invalid input, loading, success, and retry-able errors locally while
 * preserving what the user typed.
 */
export default function NewsletterForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status === "loading") return;

    const value = email.trim();
    if (!value) {
      setStatus("error");
      setErrorMsg("Please enter your email address.");
      return;
    }
    if (!EMAIL_RE.test(value)) {
      setStatus("error");
      setErrorMsg("That doesn't look like a valid email address.");
      return;
    }

    setStatus("loading");
    setErrorMsg("");
    try {
      // Lazy-load the Firebase module so the Firestore SDK stays out of the
      // landing bundle until someone actually subscribes.
      const { subscribeToNewsletter } = await import("@/lib/firebase/newsletter");
      await withTimeout(subscribeToNewsletter(value), 15000);
      setStatus("success");
    } catch {
      // Generic retry-able message; keep the typed email in the input.
      setStatus("error");
      setErrorMsg("Something went wrong, try again.");
    }
  }

  if (status === "success") {
    return (
      <div className="mt-4 flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-4 py-2.5">
        <span className="text-sm font-medium text-emerald-300">✓</span>
        <span className="text-sm text-emerald-200">
          You&apos;re in — check your inbox soon.
        </span>
      </div>
    );
  }

  const busy = status === "loading";

  return (
    <div>
      <form
        noValidate
        onSubmit={handleSubmit}
        className="mt-4 flex items-center rounded-full border border-white/10 bg-white/[0.03] py-1.5 pl-4 pr-1.5 transition focus-within:border-cyan-400/50"
      >
        <input
          type="email"
          required
          autoComplete="email"
          placeholder="your@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={busy}
          aria-label="Email address for newsletter"
          aria-invalid={status === "error"}
          aria-describedby={status === "error" ? "newsletter-error" : undefined}
          className="w-full bg-transparent text-sm text-white placeholder:text-slate-500 focus:outline-none disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={busy}
          aria-label={busy ? "Subscribing" : "Subscribe to newsletter"}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-[#06b6d4] to-[#3b82f6] text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <ArrowUpRight className="h-4 w-4" aria-hidden />
          )}
        </button>
      </form>

      {status === "error" && (
        <p id="newsletter-error" role="alert" className="mt-2 text-xs text-rose-400">
          {errorMsg}
        </p>
      )}
    </div>
  );
}
