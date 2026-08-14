/**
 * Build the Paddle checkout success URL.
 *
 * - Production / unprotected:     `${origin}/checkout/success`
 * - Protected Preview (sandbox):  `${origin}/checkout/success?x-vercel-protection-bypass=…`
 *
 * The bypass suffix comes from `NEXT_PUBLIC_VERCEL_BYPASS_QUERY`, a
 * Preview-only public env var that holds ONLY the query portion (no leading
 * `?`). It must stay empty/unset in production so the production URL is never
 * altered. The value is baked into the Preview client bundle — it is the same
 * URL credential the Preview already relies on for webhook delivery, and must
 * be revoked once the sandbox E2E is finished.
 *
 * Paddle appends its own params (`transaction_id`, `transaction_status`) to
 * whatever URL it redirects to; this builder only guarantees our portion is a
 * single, well-formed query string (no duplicate `?`).
 */
export function checkoutSuccessUrl(origin: string, bypassQuery?: string): string {
  const base = `${origin}/checkout/success`;
  const q = bypassQuery?.trim();
  if (!q) return base;
  return `${base}?${q.replace(/^\?+/, '')}`;
}
