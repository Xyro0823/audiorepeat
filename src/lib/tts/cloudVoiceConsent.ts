interface CloudVoiceConsentState {
  configured: boolean;
  enabled: boolean;
  voicesLoading: boolean;
  targetNeedsCloud: boolean;
  translationNeedsCloud: boolean;
}

/** True when playback should pause for a one-time cloud-voice opt-in. */
export function shouldOfferCloudVoiceConsent({
  configured,
  enabled,
  voicesLoading,
  targetNeedsCloud,
  translationNeedsCloud,
}: CloudVoiceConsentState): boolean {
  return (
    configured &&
    !enabled &&
    !voicesLoading &&
    (targetNeedsCloud || translationNeedsCloud)
  );
}
