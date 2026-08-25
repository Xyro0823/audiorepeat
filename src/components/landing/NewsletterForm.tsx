"use client";

import { useState, type FormEvent } from "react";
import { ArrowUpRight, Loader2 } from "lucide-react";
import { useT, type TKey } from "@/lib/i18n";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Bound the request so the form always settles into a retryable error state
 * instead of leaving the user on an endless spinner. */
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
 * Landing-page newsletter signup. Submits through the protected server API. Handles
 * empty/invalid input, loading, success, and retry-able errors locally while
 * preserving what the user typed. Copy is a dictionary key translated at
 * render time so a language switch never leaves stale English behind.
 */
export default function NewsletterForm() {
  const t = useT();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsgKey, setErrorMsgKey] = useState<TKey | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status === "loading") return;

    const value = email.trim();
    if (!value) {
      setStatus("error");
      setErrorMsgKey("landing.newsletter.emailRequired");
      return;
    }
    if (!EMAIL_RE.test(value)) {
      setStatus("error");
      setErrorMsgKey("landing.newsletter.emailInvalid");
      return;
    }

    setStatus("loading");
    setErrorMsgKey(null);
    try {
      const response = await withTimeout(fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: value }),
      }), 15000);
      if (!response.ok) throw new Error("subscribe-failed");
      setStatus("success");
    } catch {
      // Generic retry-able message; keep the typed email in the input.
      setStatus("error");
      setErrorMsgKey("landing.newsletter.error");
    }
  }

  if (status === "success") {
    return (
      <div aria-live="polite" className="mt-4 flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-4 py-2.5">
        <span className="text-sm font-medium text-emerald-300">✓</span>
        <span className="text-sm text-emerald-200">
          {t("landing.newsletter.success")}
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
          name="email"
          required
          autoComplete="email"
          spellCheck={false}
          placeholder={t("landing.newsletter.placeholder")}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={busy}
          aria-label={t("landing.newsletter.emailAria")}
          aria-invalid={status === "error"}
          aria-describedby={status === "error" ? "newsletter-error" : undefined}
          className="w-full bg-transparent text-sm text-white placeholder:text-slate-500 focus:outline-none disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={busy}
          aria-label={busy ? t("landing.newsletter.subscribingAria") : t("landing.newsletter.subscribeAria")}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-[#06b6d4] to-[#3b82f6] text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <ArrowUpRight className="h-4 w-4" aria-hidden />
          )}
        </button>
      </form>

      {status === "error" && errorMsgKey && (
        <p id="newsletter-error" role="alert" className="mt-2 text-xs text-rose-400">
          {t(errorMsgKey)}
        </p>
      )}
    </div>
  );
}
