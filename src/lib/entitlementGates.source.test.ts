import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Source-contract guard for the P0 entitlement fix: the paid features must be
 * gated through the canonical matrix (src/lib/plans.ts → planHasFeature), the
 * server must re-enforce cloud audio, and the Free daily word limit must be
 * wired into the player. Modeled on entitlementCopy.test.ts — these checks
 * fail when a refactor reintroduces an ungated path or a scattered plan check.
 */
function src(...parts: string[]): string {
  return readFileSync(join(process.cwd(), 'src', ...parts), 'utf8');
}

describe('feature gates use the canonical entitlement matrix', () => {
  it('PlayerView gates quiz, review marks/filters and cloud audio per feature', () => {
    const player = src('components', 'player', 'PlayerView.tsx');
    expect(player).toContain("planHasFeature(effective.plan, 'quiz')");
    expect(player).toContain("planHasFeature(effective.plan, 'fsrsReview')");
    expect(player).toContain("planHasFeature(effective.plan, 'offlineAudio')");
    expect(player).toContain('cloudAudioActiveFor(');
    // Quiz toggle itself no-ops without the entitlement (not just the button).
    expect(player).toContain('if (!canQuiz) return;');
    // Free daily word limit enforced at the practice boundary.
    expect(player).toContain('freeDailyLimitReached(');
    expect(player).toContain('dailyLimitReached');
  });

  it('the /review route reads its access from the canonical feature matrix', () => {
    const review = src('components', 'review', 'ReviewSession.tsx');
    expect(review).toContain("planHasFeature(settings.plan, 'fsrsReview')");
    expect(review).toContain('ProFeatureLock');
  });

  it('the /stats route locks Free users out of stats', () => {
    const stats = src('components', 'stats', 'StatsView.tsx');
    expect(stats).toContain("planHasFeature(settings.plan, 'stats')");
    expect(stats).toContain('ProFeatureLock');
  });

  it('the library gates speed challenges, review entry and audio prewarm', () => {
    const library = src('components', 'library', 'SetLibrary.tsx');
    expect(library).toContain("planHasFeature(settings.plan, 'speedChallenge')");
    expect(library).toContain("planHasFeature(settings.plan, 'fsrsReview')");
    expect(library).toContain("planHasFeature(settings.plan, 'offlineAudio')");
    expect(library).toContain("if (!canSpeed) {");
  });

  it('settings offer cloud voices only through the entitlement', () => {
    const settings = src('components', 'settings', 'SettingsModal.tsx');
    expect(settings).toContain("planHasFeature(settings.plan, 'offlineAudio')");
  });
});

describe('server-side enforcement', () => {
  it('/api/tts limits Free synthesis to the explicit Mongolian fallback', () => {
    const route = src('app', 'api', 'tts', 'route.ts');
    expect(route).toContain('computeEffectiveEntitlement');
    expect(route).toContain('cloudTtsAccessFor(effective.plan, lang)');
    expect(route).toContain('FREE_MONGOLIAN_TTS_DAILY_LIMIT');
    expect(route).toContain("'pro-required'");
    expect(route).toContain('403');
  });
});

describe('no client-side bypass via scattered plan checks', () => {
  it('feature-bearing surfaces no longer hardcode isProPlan for gating', () => {
    // These files must exclusively use the feature matrix. (isProPlan stays
    // legitimate for pure display copy — badges, plan labels — elsewhere.)
    for (const file of [
      src('components', 'player', 'PlayerView.tsx'),
      src('components', 'library', 'SetLibrary.tsx'),
      src('components', 'review', 'ReviewSession.tsx'),
      src('components', 'stats', 'StatsView.tsx'),
    ]) {
      expect(file).not.toContain('isProPlan(');
    }
  });

  it('the cloud-audio predicate fails closed on plan first', () => {
    const gate = src('lib', 'tts', 'cloudAudioGate.ts');
    // The plan check must precede any user-toggle logic in the predicate.
    const planCheck = gate.indexOf('planHasFeature(input.plan,');
    const toggleLogic = gate.indexOf('input.cloudReady &&');
    expect(planCheck).toBeGreaterThan(-1);
    expect(toggleLogic).toBeGreaterThan(planCheck);
  });
});
