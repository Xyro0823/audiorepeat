/**
 * Pure success-flow logic for /checkout/success.
 *
 * The server entitlement record (Firestore, written only by the verified
 * Paddle webhook) is the source of truth for Pro/Lifetime. A `transaction_id`
 * query param, if present, is at most display context — it must never grant
 * anything. This module exists so the polling/activation decision can be unit
 * tested without a DOM or network.
 */

export type EntitlementPlan = 'basic' | 'pro' | 'lifetime';

export interface EntitlementSnapshot {
  plan: EntitlementPlan;
  billing?: string | null;
}

export type SuccessDecision =
  | { kind: 'active'; plan: 'pro' | 'lifetime'; billing: string | null }
  | { kind: 'keep-polling' }
  | { kind: 'timeout-pending' }
  | { kind: 'unauthenticated' };

export function isPaidPlan(plan: EntitlementPlan | null | undefined): plan is 'pro' | 'lifetime' {
  return plan === 'pro' || plan === 'lifetime';
}

/**
 * Decide what one poll result means. Only a server-reported paid plan can
 * activate; basic/free or a failed fetch keeps polling until the attempt
 * budget is exhausted, then reports a non-destructive pending state.
 */
export function decidePollResult(
  snapshot: EntitlementSnapshot | null,
  attempt: number,
  maxAttempts: number,
): SuccessDecision {
  if (snapshot && isPaidPlan(snapshot.plan)) {
    return { kind: 'active', plan: snapshot.plan, billing: snapshot.billing ?? null };
  }
  return attempt >= maxAttempts ? { kind: 'timeout-pending' } : { kind: 'keep-polling' };
}

/**
 * Map a confirmed server entitlement to the local settings mirror. Lifetime
 * uses the 'annual' cycle slot (matches authStore.syncPlanFromServer).
 */
export function planBillingForEntitlement(
  plan: 'pro' | 'lifetime',
  billing: string | null,
): 'monthly' | 'annual' {
  if (plan === 'lifetime') return 'annual';
  return billing === 'monthly' ? 'monthly' : 'annual';
}

export interface SuccessPollDeps {
  /** Firebase ID token; null means the visitor isn't authenticated. */
  getToken: () => Promise<string | null>;
  /** Fetch the authenticated user's entitlement; null on network/server error. */
  fetchEntitlement: (token: string) => Promise<EntitlementSnapshot | null>;
  maxAttempts?: number;
  delayMs?: number;
  /** Injectable wait for tests; defaults to setTimeout. */
  wait?: (ms: number) => Promise<void>;
}

function defaultWait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Poll /api/entitlement until the server confirms a paid plan (or the budget
 * runs out). The caller never grants locally — the returned decision is
 * authoritative only because it came from the server entitlement.
 */
export async function runSuccessPoll(deps: SuccessPollDeps): Promise<SuccessDecision> {
  const { getToken, fetchEntitlement } = deps;
  const maxAttempts = deps.maxAttempts ?? 15;
  const delayMs = deps.delayMs ?? 2000;
  const wait = deps.wait ?? defaultWait;

  const token = await getToken();
  if (!token) return { kind: 'unauthenticated' };

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const snapshot = await fetchEntitlement(token);
    const decision = decidePollResult(snapshot, attempt, maxAttempts);
    if (decision.kind !== 'keep-polling') return decision;
    if (attempt < maxAttempts) await wait(delayMs);
  }

  return { kind: 'timeout-pending' };
}
