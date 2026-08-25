'use client';

import { useT, type TKey, type TVars } from '@/lib/i18n';
import { FREE_LANG_LIMIT } from '@/lib/plans';

/**
 * Display-layer localization of the canonical plan copy from lib/plans
 * (shared by the landing pricing section and the checkout flow).
 * Names, prices and entitlements stay untouched — only rendered bullet and
 * note text is routed through the dictionary. Returns null for unknown
 * strings so the canonical English always stands.
 */
export function planCopy(text: string): { key: TKey; vars?: TVars } | null {
  const freeLangs = new RegExp(`^${FREE_LANG_LIMIT} active languages?$`);
  const allLangs = /^All (\d+) languages$/;
  const daily = /^(\d+) words \/ day$/;
  let m: RegExpMatchArray | null;
  if (freeLangs.test(text)) {
    return { key: 'landing.plan.bullet.activeLanguage', vars: { limit: FREE_LANG_LIMIT } };
  }
  if ((m = text.match(allLangs))) {
    return { key: 'landing.plan.bullet.allLanguages', vars: { count: Number(m[1]) } };
  }
  if ((m = text.match(daily))) {
    return { key: 'landing.plan.bullet.dailyWords', vars: { limit: Number(m[1]) } };
  }
  switch (text) {
    case 'Standard TTS audio': return { key: 'landing.plan.bullet.standardTts' };
    case 'Pronunciation practice tools': return { key: 'landing.plan.bullet.pronunciation' };
    case 'Offline audio packs': return { key: 'landing.plan.bullet.offlinePacks' };
    case 'Spaced repetition + quiz mode': return { key: 'landing.plan.bullet.spacedQuiz' };
    case 'Speed challenges & stats': return { key: 'landing.plan.bullet.speedStats' };
    case 'Everything in Pro': return { key: 'landing.plan.bullet.everythingInPro' };
    case 'Future languages included': return { key: 'landing.plan.bullet.futureLanguages' };
    case 'Priority support': return { key: 'landing.plan.bullet.prioritySupport' };
    case 'forever free': return { key: 'landing.plan.note.foreverFree' };
    case '/year': return { key: 'landing.plan.note.perYear' };
    case '/mo': return { key: 'landing.plan.note.perMonth' };
    case 'one-time payment': return { key: 'landing.plan.note.oneTime' };
    default: return null;
  }
}

/** Canonical plan string rendered in the active UI language. */
export function PlanText({ text }: { text: string }) {
  const t = useT();
  const copy = planCopy(text);
  return <>{copy ? t(copy.key, copy.vars) : text}</>;
}

/** Localized plan tagline key for a plan id. */
export function planTaglineKey(planId: 'basic' | 'pro' | 'lifetime'): TKey {
  return `landing.plan.${planId}.tagline`;
}
