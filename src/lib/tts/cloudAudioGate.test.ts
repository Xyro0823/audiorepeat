import { describe, expect, it } from 'vitest';
import { cloudAudioActiveFor } from '@/lib/tts/cloudAudioGate';

describe('cloudAudioActiveFor — cloud-audio entitlement', () => {
  it('keeps full cloud audio off for Free plans', () => {
    // A user editing local settings (cloudTts/cachedAudio both on, cloud
    // configured, missing device voices) still gets device voices only.
    expect(
      cloudAudioActiveFor({
        plan: 'basic',
        cloudReady: true,
        cloudTts: true,
        cachedAudio: true,
        deviceVoiceMissing: true,
      }),
    ).toBe(false);
  });

  it('allows only the on-demand Mongolian explanation fallback for Free', () => {
    expect(
      cloudAudioActiveFor({
        plan: 'basic', cloudReady: true, cloudTts: false, cachedAudio: false,
        deviceVoiceMissing: true, freeMongolianTranslation: true,
      }),
    ).toBe(true);
    expect(
      cloudAudioActiveFor({
        plan: 'basic', cloudReady: false, cloudTts: true, cachedAudio: true,
        deviceVoiceMissing: true, freeMongolianTranslation: true,
      }),
    ).toBe(false);
  });

  it('activates for Pro when consented and wanted', () => {
    const base = { plan: 'pro' as const, cloudReady: true, cloudTts: true };
    expect(cloudAudioActiveFor({ ...base, cachedAudio: true, deviceVoiceMissing: false })).toBe(true);
    expect(cloudAudioActiveFor({ ...base, cachedAudio: false, deviceVoiceMissing: true })).toBe(true);
    // iOS-style: cached <audio> path is the lock-screen-safe route.
    expect(
      cloudAudioActiveFor({ plan: 'lifetime', cloudReady: true, cloudTts: true, cachedAudio: true, deviceVoiceMissing: false }),
    ).toBe(true);
  });

  it('stays off without consent or server configuration', () => {
    expect(
      cloudAudioActiveFor({ plan: 'pro', cloudReady: true, cloudTts: false, cachedAudio: true, deviceVoiceMissing: true }),
    ).toBe(false);
    expect(
      cloudAudioActiveFor({ plan: 'pro', cloudReady: false, cloudTts: true, cachedAudio: true, deviceVoiceMissing: true }),
    ).toBe(false);
  });
});
