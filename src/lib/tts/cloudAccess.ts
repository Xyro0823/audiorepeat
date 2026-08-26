import { planHasFeature, type PlanId } from '@/lib/plans';

/** Free accounts can generate a small number of Mongolian explanations each day. */
export const FREE_MONGOLIAN_TTS_DAILY_LIMIT = 10;

export type CloudTtsAccess = 'pro' | 'free-mongolian';

export function isMongolianLocale(lang: string): boolean {
  return lang.trim().toLowerCase().split('-')[0] === 'mn';
}

/**
 * Pro keeps full cloud-audio access. Free is deliberately limited to the
 * Mongolian explanation spoken to a Mongolian-interface learner.
 */
export function cloudTtsAccessFor(plan: PlanId, lang: string): CloudTtsAccess | null {
  if (planHasFeature(plan, 'offlineAudio')) return 'pro';
  return isMongolianLocale(lang) ? 'free-mongolian' : null;
}
