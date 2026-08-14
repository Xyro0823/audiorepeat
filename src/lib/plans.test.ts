import { describe, expect, it } from 'vitest';
import { isProPlan, planDetail } from '@/lib/plans';

describe('planDetail — user-facing plan copy', () => {
  it('shows the real billing detail for a paid Paddle Pro user', () => {
    expect(planDetail('pro', 'monthly', 'paddle')).toBe('Pro · $4.99/mo');
    expect(planDetail('pro', 'annual', 'paddle')).toBe('Pro · $39.99/yr');
    // Existing callers that don't pass a source keep the old behavior.
    expect(planDetail('pro', 'monthly')).toBe('Pro · $4.99/mo');
  });

  it('shows neutral Gift access copy for a manual Pro grant — never a price', () => {
    expect(planDetail('pro', 'monthly', 'manual')).toBe('Pro · Gift access');
    expect(planDetail('pro', 'annual', 'manual')).toBe('Pro · Gift access');
  });

  it('keeps the Lifetime detail unchanged for every source', () => {
    expect(planDetail('lifetime', 'annual', 'manual')).toBe('Lifetime · one-time payment');
    expect(planDetail('lifetime', 'annual', 'paddle')).toBe('Lifetime · one-time payment');
    expect(planDetail('lifetime', 'annual')).toBe('Lifetime · one-time payment');
  });

  it('keeps the Free copy unchanged', () => {
    expect(planDetail('basic', 'annual')).toBe('Free plan — upgrade anytime');
    expect(planDetail('basic', 'annual', 'manual')).toBe('Free plan — upgrade anytime');
  });

  it('isProPlan still treats Pro and Lifetime as paid plans', () => {
    expect(isProPlan('pro')).toBe(true);
    expect(isProPlan('lifetime')).toBe(true);
    expect(isProPlan('basic')).toBe(false);
  });
});
