import { describe, expect, it } from 'vitest';
import { FREE_LANG_LIMIT, LANGUAGES_UNLOCKED_BY_PRO, PLANS } from '@/lib/plans';
import { SEED_SETS } from '@/lib/seedSets';
import { SUPPORTED_LANGUAGE_COUNT } from '@/lib/freeLang';

/**
 * Pins the public-facing prices to the values shown on the landing page and
 * checkout. These are the numbers a Paddle reviewer will see, so any change
 * here is a deliberate product/billing decision.
 */
describe('public pricing constants — Paddle compliance', () => {
  it('Pro monthly is $4.99 per month', () => {
    expect(PLANS.pro.priceFor(false)).toEqual({ price: 4.99, note: '/mo' });
  });

  it('Pro annual is $39.99 per year', () => {
    expect(PLANS.pro.priceFor(true)).toEqual({ price: 39.99, note: '/year' });
  });

  it('Lifetime is $79.99 one-time', () => {
    expect(PLANS.lifetime.priceFor(false)).toEqual({
      price: 79.99,
      note: 'one-time payment',
    });
  });

  it('Free plan costs nothing', () => {
    expect(PLANS.basic.priceFor(false)).toEqual({ price: 0, note: 'forever free' });
  });
});

describe('LANGUAGES_UNLOCKED_BY_PRO — dashboard upgrade-notice entitlement', () => {
  it('is the entitlement gap between Free and Pro, derived from canonical constants', () => {
    expect(LANGUAGES_UNLOCKED_BY_PRO).toBe(SUPPORTED_LANGUAGE_COUNT - FREE_LANG_LIMIT);
  });

  it('is currently 28 (29 supported languages minus the Free plan\'s 1 active language)', () => {
    expect(LANGUAGES_UNLOCKED_BY_PRO).toBe(28);
    expect(SUPPORTED_LANGUAGE_COUNT).toBe(29);
    expect(FREE_LANG_LIMIT).toBe(1);
  });

  it('is a positive, real unlock — upgrading genuinely grants more languages', () => {
    expect(LANGUAGES_UNLOCKED_BY_PRO).toBeGreaterThan(0);
    expect(LANGUAGES_UNLOCKED_BY_PRO).toBeLessThan(SUPPORTED_LANGUAGE_COUNT);
  });

  it('is NOT the count of locally seeded set languages', () => {
    // Regression: the notice once computed "missing" from visible local sets
    // (guest installs showed 26 because 3 seed languages were already
    // present as cards). The number users see must come from the plan
    // entitlement, so it must not depend on how many SEED_SETS exist or how
    // many are already owned locally.
    const seedUnique = new Set(SEED_SETS.map((s) => s.lang)).size;
    expect(LANGUAGES_UNLOCKED_BY_PRO).not.toBe(seedUnique);
  });
});
