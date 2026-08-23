import { planHasFeature, type PlanId } from '@/lib/plans';

/**
 * Client-side gate for cloud-generated audio (Azure voices + offline audio
 * packs). The entitlement decision is plan-scoped and comes exclusively from
 * the canonical matrix in src/lib/plans.ts — user-editable settings
 * (`cloudTts`, `cachedAudio`) can never unlock it for a Free plan. The server
 * re-enforces the same entitlement in /api/tts, so toggling local state can't
 * bypass the gate where it actually costs money.
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
}

/** True when cloud-generated audio may actually be fetched and cached. */
export function cloudAudioActiveFor(input: CloudAudioGateInput): boolean {
  if (!planHasFeature(input.plan, 'offlineAudio')) return false;
  return input.cloudReady && input.cloudTts && (input.cachedAudio || input.deviceVoiceMissing);
}
