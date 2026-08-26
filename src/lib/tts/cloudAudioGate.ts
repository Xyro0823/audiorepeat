import { planHasFeature, type PlanId } from '@/lib/plans';

/**
 * Client-side gate for cloud-generated audio (Azure voices + offline audio
 * packs). The entitlement decision is plan-scoped and comes exclusively from
 * the canonical matrix in src/lib/plans.ts — user-editable settings
 * (`cloudTts`, `cachedAudio`) can never unlock full cloud audio for a Free
 * plan. A deliberately narrow exception lets a Mongolian explanation use
 * Azure on demand; /api/tts still limits both the language and daily usage.
 */
export interface CloudAudioGateInput {
  plan: PlanId;
  /** /api/tts is configured on this server. */
  cloudReady: boolean;
  /** User consented to cloud voices (settings.cloudTts). */
  cloudTts: boolean;
  /** Cached/offline playback is wanted (settings.cachedAudio or iOS, where
   *  cached <audio> is the only lock-screen-safe path). */
  cachedAudio: boolean;
  /** The device has no voice for the target or translation language. */
  deviceVoiceMissing: boolean;
  /** A Mongolian explanation is visible and needs a voice on a Free plan. */
  freeMongolianTranslation?: boolean;
}

/** True when cloud-generated audio may actually be fetched and cached. */
export function cloudAudioActiveFor(input: CloudAudioGateInput): boolean {
  const paidAccess = planHasFeature(input.plan, 'offlineAudio');
  const freeMongolianAccess = !paidAccess && input.freeMongolianTranslation === true;
  if (!paidAccess && !freeMongolianAccess) return false;
  // The Free Mongolian fallback is on-demand only. It does not prewarm a set,
  // and server-side language checks plus a daily limit protect Azure spend.
  const enabled = paidAccess ? input.cloudTts : true;
  return input.cloudReady && enabled && (input.cachedAudio || input.deviceVoiceMissing);
}
