/**
 * Merchant / legal identity used by the public legal pages.
 *
 * AudioRepeat is the public product/brand name. Evoq is the operator/legal
 * name displayed in the legal documents. The service is governed by the laws
 * of Mongolia and support is handled via the public support address.
 *
 * These values were confirmed by the owner; no placeholders remain.
 */
export const LEGAL_IDENTITY = {
  /** Public product/brand name shown to customers. */
  operator: "AudioRepeat",
  /** Operator/legal entity name. */
  legalName: "Evoq",
  /** Jurisdiction whose law governs the Terms. */
  governingLaw: "Mongolia",
  /** Public support/contact address. */
  supportEmail: "tomodachirelax@gmail.com",
} as const;
