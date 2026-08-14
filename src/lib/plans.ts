/**
 * Shared plan/pricing data — the single source of truth for plan names,
 * prices and features. Used by the landing page pricing section and the
 * /checkout flow so a future real payment backend reads the same numbers.
 *
 * Display prices reflect the Paddle catalog (migration in progress):
 * Pro $4.99/mo, Pro $39.99/yr, Lifetime $79.99 one-time. Provider billing
 * (Stripe IDs etc.) is intentionally NOT in this file.
 */

export type PlanId = 'basic' | 'pro' | 'lifetime';

export const PLAN_ORDER: PlanId[] = ['basic', 'pro', 'lifetime'];

export function isPlanId(v: string | undefined | null): v is PlanId {
  return v === 'basic' || v === 'pro' || v === 'lifetime';
}

/** True when the plan unlocks Pro-only features (Pro or Lifetime). */
export function isProPlan(plan: PlanId): boolean {
  return plan === 'pro' || plan === 'lifetime';
}

/** Number of active languages included with the Free plan. */
export const FREE_LANG_LIMIT = 1;

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
    return billing === 'annual' ? 'Pro · $39.99/yr' : 'Pro · $4.99/mo';
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
    features: () => [`${FREE_LANG_LIMIT} active language${FREE_LANG_LIMIT === 1 ? '' : 's'}`, 'Standard TTS audio', '300 words / day'],
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    tagline: 'The full learning engine',
    cta: 'Go Pro',
    popular: true,
    priceFor: (annual) =>
      annual
        ? { price: 39.99, note: '/year' }
        : { price: 4.99, note: '/mo' },
    features: (langCount) => [
      `All ${langCount} languages`,
      'AI pronunciation coach',
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
