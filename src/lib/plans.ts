/**
 * Shared plan/pricing data — the single source of truth for plan names,
 * prices and features. Used by the landing page pricing section and the
 * /checkout flow so a future real payment backend reads the same numbers.
 */

export type PlanId = 'basic' | 'pro' | 'lifetime';

export const PLAN_ORDER: PlanId[] = ['basic', 'pro', 'lifetime'];

export function isPlanId(v: string | undefined): v is PlanId {
  return v === 'basic' || v === 'pro' || v === 'lifetime';
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
    features: () => ['1 active language', 'Standard TTS audio', '300 words / day'],
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    tagline: 'The full learning engine',
    cta: 'Go Pro',
    popular: true,
    priceFor: (annual) =>
      annual
        ? { price: 7, note: '/mo, billed $84 annually' }
        : { price: 9, note: '/mo' },
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
    priceFor: () => ({ price: 149, note: 'one-time payment' }),
    features: () => ['Everything in Pro', 'Future languages included', 'Priority support'],
  },
};
