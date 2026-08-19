import { getAuthIdToken } from '@/lib/authStore';

export async function recordPlanInterest(_userId: string, plan: string, billing: string): Promise<void> {
  const token = await getAuthIdToken();
  if (!token) throw new Error('unauthenticated');
  const response = await fetch('/api/plan-interest', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ plan, billing }) });
  if (!response.ok) throw new Error('plan-interest-failed');
}

/** Purchases are recorded only by verified payment webhooks. */
export async function recordPlanPurchase(): Promise<never> {
  throw new Error('purchase-recording-is-server-only');
}
