import { describe, expect, it } from 'vitest';
import { PLANS } from '@/lib/plans';

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
