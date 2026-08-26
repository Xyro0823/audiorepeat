import { planHasFeature, type PlanId } from '@/lib/plans';

/**
 * Free learners may hear a complete starter lesson in Mongolian. Audio is
 * cached after the first request, so this caps genuinely new daily phrases
 * while matching the product's 300-word Free practice allowance.
 */
export const FREE_MONGOLIAN_TTS_DAILY_LIMIT = 300;

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
