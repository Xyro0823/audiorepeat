/**
 * Shared plan/pricing data — the single source of truth for plan names,
 * prices and features. Used by the landing page pricing section and the
 * /checkout flow so a future real payment backend reads the same numbers.
 *
 * Display prices reflect the Paddle catalog (migration in progress):
 * Pro $4.99/mo, Pro $39.99/yr, Lifetime $79.99 one-time. Provider billing
 * (Stripe IDs etc.) is intentionally NOT in this file.
 */

import { SUPPORTED_LANGUAGE_COUNT } from '@/lib/freeLang';

export type PlanId = 'basic' | 'pro' | 'lifetime';

export const PLAN_ORDER: PlanId[] = ['basic', 'pro', 'lifetime'];

export function isPlanId(v: string | undefined | null): v is PlanId {
  return v === 'basic' || v === 'pro' || v === 'lifetime';
}

/** True when the plan unlocks Pro-only features (Pro or Lifetime). */
export function isProPlan(plan: PlanId): boolean {
  return plan === 'pro' || plan === 'lifetime';
}

/* ------------------------------------------------------------------------ */
/* Feature entitlement matrix — the ONE canonical gate                       */
/* ------------------------------------------------------------------------ */

/**
 * Machine-readable feature entitlements. Every Free/Pro gate (client UI,
 * client engines, server API routes) must go through `planHasFeature` —
 * never a scattered `plan === 'pro'` check. The marketing feature lists in
 * `PLANS` below describe these same entitlements in human copy.
 */
export type FeatureKey =
  | 'allLanguages'
  | 'fsrsReview'
  | 'quiz'
  | 'speedChallenge'
  | 'stats'
  | 'offlineAudio';

const PRO_FEATURES: FeatureKey[] = [
  'allLanguages',
  'fsrsReview',
  'quiz',
  'speedChallenge',
  'stats',
  'offlineAudio',
];

/** Feature entitlements per plan: Free gets none, Pro/Lifetime get all. */
export const PLAN_FEATURES: Record<PlanId, FeatureKey[]> = {
  basic: [],
  pro: PRO_FEATURES,
  lifetime: PRO_FEATURES,
};

/** The single entitlement predicate used by every gate in the app. */
export function planHasFeature(plan: PlanId, feature: FeatureKey): boolean {
  return PLAN_FEATURES[plan].includes(feature);
}

/**
 * True when the Free plan's daily word allowance is exhausted and practice
 * must stop for the rest of the local day. Pro/Lifetime are never limited.
 * The counter itself lives in practice stats (`wordsToday`); the day rolls
 * over at local midnight via `dayKey`.
 */
export function freeDailyLimitReached(plan: PlanId, wordsToday: number): boolean {
  return !isProPlan(plan) && wordsToday >= FREE_DAILY_WORD_LIMIT;
}

/** Number of active languages included with the Free plan. */
export const FREE_LANG_LIMIT = 1;

/** Words per day included with the Free plan (Pro/Lifetime are unlimited). */
export const FREE_DAILY_WORD_LIMIT = 300;

export const PRO_MONTHLY_PRICE = 4.99;
export const PRO_ANNUAL_PRICE = 39.99;

export function annualSavingsPercent(
  monthlyPrice = PRO_MONTHLY_PRICE,
  annualPrice = PRO_ANNUAL_PRICE,
): number {
  return Math.round((1 - annualPrice / (monthlyPrice * 12)) * 100);
}

export const ANNUAL_SAVINGS_PERCENT = annualSavingsPercent();

/**
 * Languages a Free-plan user unlocks by upgrading to Pro/Lifetime — the
 * entitlement gap between the Free plan's single active language and the
 * full supported-language catalog. This is a plan entitlement, derived from
 * canonical constants, never from how many seeded sets/cards happen to exist
 * locally (a local install may carry cards for languages the plan still
 * gates).
 */
export const LANGUAGES_UNLOCKED_BY_PRO = SUPPORTED_LANGUAGE_COUNT - FREE_LANG_LIMIT;

/** Short badge text + full label for surfacing the plan in the UI. */
export const PLAN_BADGE: Record<PlanId, { short: string; label: string }> = {
  basic: { short: 'Free', label: 'Free plan' },
  pro: { short: 'Pro', label: 'Pro plan' },
  lifetime: { short: 'Lifetime', label: 'Lifetime plan' },
};

/**
 * One-line plan description for the profile dropdown / settings.
 *
 * A manual/gift Pro (`source === 'manual'`) shows neutral copy instead of a
 * price the user never paid. Paid Paddle users keep their billing detail.
 */
export function planDetail(
  plan: PlanId,
  billing: 'monthly' | 'annual',
  source?: 'manual' | 'paddle' | null,
): string {
  if (plan === 'lifetime') return 'Lifetime · one-time payment';
  if (plan === 'pro') {
    if (source === 'manual') return 'Pro · Gift access';
    return billing === 'annual'
      ? `Pro · $${PRO_ANNUAL_PRICE}/yr`
      : `Pro · $${PRO_MONTHLY_PRICE}/mo`;
  }
  return 'Free plan — upgrade anytime';
}

export interface PlanDef {
  id: PlanId;
  name: string;
  tagline: string;
  cta: string;
  popular: boolean;
  /** Display price + suffix for the given billing cycle (true = annual). */
  priceFor: (annual: boolean) => { price: number; note: string };
  features: (langCount: number) => string[];
}

export const PLANS: Record<PlanId, PlanDef> = {
  basic: {
    id: 'basic',
    name: 'Basic',
    tagline: 'For curious beginners',
    cta: 'Start free',
    popular: false,
    priceFor: () => ({ price: 0, note: 'forever free' }),
    features: () => [
      `${FREE_LANG_LIMIT} active language${FREE_LANG_LIMIT === 1 ? '' : 's'}`,
      'Standard TTS audio',
      `${FREE_DAILY_WORD_LIMIT} words / day`,
    ],
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    tagline: 'The full learning engine',
    cta: 'Go Pro',
    popular: true,
    priceFor: (annual) =>
      annual
        ? { price: PRO_ANNUAL_PRICE, note: '/year' }
        : { price: PRO_MONTHLY_PRICE, note: '/mo' },
    features: (langCount) => [
      `All ${langCount} languages`,
      'Pronunciation practice tools',
      'Offline audio packs',
      'Spaced repetition + quiz mode',
      'Speed challenges & stats',
    ],
  },
  lifetime: {
    id: 'lifetime',
    name: 'Lifetime',
    tagline: 'One payment, forever',
    cta: 'Get Lifetime',
    popular: false,
    priceFor: () => ({ price: 79.99, note: 'one-time payment' }),
    features: () => ['Everything in Pro', 'Future languages included', 'Priority support'],
  },
};
