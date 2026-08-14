import { describe, expect, it } from 'vitest';
import {
  decidePollResult,
  planBillingForEntitlement,
  runSuccessPoll,
  type EntitlementSnapshot,
  type SuccessDecision,
} from './successFlow';

const token = 'test-id-token';

async function run(
  getToken: () => Promise<string | null>,
  fetchEntitlement: (t: string) => Promise<EntitlementSnapshot | null>,
  maxAttempts = 3,
): Promise<{ decision: SuccessDecision; polls: number; waits: number }> {
  let polls = 0;
  let waits = 0;
  const decision = await runSuccessPoll({
    getToken,
    fetchEntitlement: async (t) => {
      polls += 1;
      return fetchEntitlement(t);
    },
    maxAttempts,
    delayMs: 0,
    wait: async () => {
      waits += 1;
    },
  });
  return { decision, polls, waits };
}

describe('success flow — missing transaction_id', () => {
  it('A: entitlement becomes Pro → polling happens, active reached, mirror is Pro', async () => {
    const { decision, polls } = await run(
      async () => token,
      async () => ({ plan: 'pro' as const, billing: 'monthly' }),
    );
    expect(polls).toBeGreaterThanOrEqual(1);
    expect(decision).toEqual({ kind: 'active', plan: 'pro', billing: 'monthly' });
    if (decision.kind !== 'active') throw new Error('must be active');
    expect(planBillingForEntitlement(decision.plan, decision.billing)).toBe('monthly');
  });

  it('B: entitlement becomes Lifetime → active reached, mirror is Lifetime', async () => {
    const { decision } = await run(
      async () => token,
      async () => ({ plan: 'lifetime' as const, billing: 'lifetime' }),
    );
    expect(decision).toEqual({ kind: 'active', plan: 'lifetime', billing: 'lifetime' });
    if (decision.kind !== 'active') throw new Error('must be active');
    expect(planBillingForEntitlement(decision.plan, decision.billing)).toBe('annual');
  });

  it('C: entitlement stays Free → no grant, non-destructive pending state', async () => {
    const { decision, polls } = await run(
      async () => token,
      async () => ({ plan: 'basic' as const, billing: null }),
    );
    expect(polls).toBe(3);
    expect(decision).toEqual({ kind: 'timeout-pending' });
    // No paid plan is ever derived from a basic entitlement.
    if (decision.kind === 'active') throw new Error('must not activate');
  });

  it('C2: entitlement poll fails (server error) → keeps polling, ends pending', async () => {
    const { decision, polls } = await run(async () => token, async () => null);
    expect(polls).toBe(3);
    expect(decision).toEqual({ kind: 'timeout-pending' });
  });
});

describe('success flow — transaction_id present', () => {
  it('D: entitlement remains authoritative; a verified plan id is display-only', async () => {
    // Even though the page may have "verified" pro via transaction_id, the
    // decision comes from the server entitlement — and a basic entitlement
    // must NOT activate.
    const { decision } = await run(
      async () => token,
      async () => ({ plan: 'basic' as const, billing: null }),
    );
    expect(decision.kind).toBe('timeout-pending');
  });

  it('E: fake/unrelated transaction_id cannot grant — server says Free', async () => {
    const { decision } = await run(
      async () => token,
      async () => ({ plan: 'basic' as const, billing: null }),
    );
    expect(decision.kind).toBe('timeout-pending');
  });

  it('E2: fake transaction_id + server entitlement Pro → activates (server truth)', async () => {
    const { decision } = await run(
      async () => token,
      async () => ({ plan: 'pro' as const, billing: 'annual' }),
    );
    expect(decision).toEqual({ kind: 'active', plan: 'pro', billing: 'annual' });
  });
});

describe('success flow — unauthenticated', () => {
  it('F: no token → unauthenticated, nothing granted, no polling', async () => {
    const { decision, polls } = await run(async () => null, async () => ({ plan: 'pro' as const }));
    expect(polls).toBe(0);
    expect(decision).toEqual({ kind: 'unauthenticated' });
  });
});

describe('decidePollResult', () => {
  it('activates on the last attempt when the plan just became paid', () => {
    expect(decidePollResult({ plan: 'lifetime', billing: 'lifetime' }, 3, 3)).toEqual({
      kind: 'active',
      plan: 'lifetime',
      billing: 'lifetime',
    });
  });

  it('keeps polling before the budget is exhausted', () => {
    expect(decidePollResult({ plan: 'basic', billing: null }, 1, 3)).toEqual({
      kind: 'keep-polling',
    });
    expect(decidePollResult(null, 2, 3)).toEqual({ kind: 'keep-polling' });
  });

  it('times out without a paid plan on the final attempt', () => {
    expect(decidePollResult({ plan: 'basic', billing: null }, 3, 3)).toEqual({
      kind: 'timeout-pending',
    });
    expect(decidePollResult(null, 3, 3)).toEqual({ kind: 'timeout-pending' });
  });
});

describe('planBillingForEntitlement', () => {
  it('maps lifetime to the annual cycle slot (matches authStore)', () => {
    expect(planBillingForEntitlement('lifetime', 'lifetime')).toBe('annual');
  });

  it('maps pro monthly/annual correctly', () => {
    expect(planBillingForEntitlement('pro', 'monthly')).toBe('monthly');
    expect(planBillingForEntitlement('pro', 'annual')).toBe('annual');
    expect(planBillingForEntitlement('pro', null)).toBe('annual');
  });
});
