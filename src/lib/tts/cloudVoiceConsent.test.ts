import { describe, expect, it } from 'vitest';
import { shouldOfferCloudVoiceConsent } from './cloudVoiceConsent';

const ready = {
  configured: true,
  enabled: false,
  voicesLoading: false,
  targetNeedsCloud: false,
  translationNeedsCloud: false,
};

describe('shouldOfferCloudVoiceConsent', () => {
  it('offers consent when the target language has no device voice', () => {
    expect(shouldOfferCloudVoiceConsent({ ...ready, targetNeedsCloud: true })).toBe(true);
  });

  it('offers consent when only the translation language has no device voice', () => {
    expect(shouldOfferCloudVoiceConsent({ ...ready, translationNeedsCloud: true })).toBe(true);
  });

  it('does not interrupt playback after consent is saved', () => {
    expect(
      shouldOfferCloudVoiceConsent({ ...ready, enabled: true, targetNeedsCloud: true }),
    ).toBe(false);
  });

  it('waits for device voice discovery before prompting', () => {
    expect(
      shouldOfferCloudVoiceConsent({ ...ready, voicesLoading: true, targetNeedsCloud: true }),
    ).toBe(false);
  });

  it('does not prompt when cloud speech is unavailable', () => {
    expect(
      shouldOfferCloudVoiceConsent({ ...ready, configured: false, targetNeedsCloud: true }),
    ).toBe(false);
  });
});
