import { describe, expect, it } from 'vitest';
import {
  ONBOARDING_EVENT_NAMES,
  ONBOARDING_GOAL_IDS,
  ONBOARDING_LANGUAGE_KEYS,
  validateOnboardingEvent,
  type OnboardingEventPayload,
} from '@/lib/analytics/events';
import { ONBOARDING_GOALS } from '@/lib/onboarding';

const ok = (
  event: string,
  properties: Record<string, string> = {},
): OnboardingEventPayload | null => validateOnboardingEvent({ event, properties });

describe('validateOnboardingEvent — schema pinning', () => {
  it('every event name is the canonical, expected set', () => {
    expect(ONBOARDING_EVENT_NAMES).toEqual([
      'onboarding_started',
      'onboarding_language_selected',
      'onboarding_level_selected',
      'onboarding_goal_selected',
      'onboarding_ready_viewed',
      'onboarding_recommended_practice_started',
      'onboarding_dashboard_skipped',
      'onboarding_completed',
    ]);
  });

  it('goal ids cannot drift from the onboarding goal list', () => {
    expect(ONBOARDING_GOAL_IDS).toEqual(ONBOARDING_GOALS.map((g) => g.id));
  });

  it('language allowlist is non-empty and normalized (pack-level keys)', () => {
    expect(ONBOARDING_LANGUAGE_KEYS.length).toBeGreaterThan(0);
    expect(new Set(ONBOARDING_LANGUAGE_KEYS).size).toBe(ONBOARDING_LANGUAGE_KEYS.length);
    expect(ONBOARDING_LANGUAGE_KEYS).toContain('mn');
    expect(ONBOARDING_LANGUAGE_KEYS).toContain('es');
  });
});

describe('validateOnboardingEvent — accepted payloads', () => {
  it('accepts onboarding_started with empty properties', () => {
    const ev = ok('onboarding_started');
    expect(ev).toEqual({ event: 'onboarding_started', properties: {} });
  });

  it('accepts onboarding_started when properties is omitted', () => {
    expect(validateOnboardingEvent({ event: 'onboarding_started' })).toEqual({
      event: 'onboarding_started',
      properties: {},
    });
  });

  it('accepts a valid language selection', () => {
    expect(ok('onboarding_language_selected', { language: 'mn' })).toEqual({
      event: 'onboarding_language_selected',
      properties: { language: 'mn' },
    });
  });

  it('accepts a valid level selection', () => {
    expect(ok('onboarding_level_selected', { language: 'mn', level: 'B1' })).toMatchObject({
      properties: { language: 'mn', level: 'B1' },
    });
  });

  it('accepts a valid goal selection', () => {
    expect(ok('onboarding_goal_selected', { language: 'mn', level: 'A1', goal: 'general' })).toMatchObject({
      properties: { goal: 'general' },
    });
  });

  it('accepts a valid ready_viewed with recommendation fields', () => {
    const ev = ok('onboarding_ready_viewed', {
      language: 'mn',
      level: 'A1',
      goal: 'general',
      recommendationType: 'cefr',
      recommendationId: 'bank-full-mn-A1',
    });
    expect(ev).toMatchObject({ properties: { recommendationType: 'cefr', recommendationId: 'bank-full-mn-A1' } });
  });

  it('accepts a valid completed event with a completion action', () => {
    expect(ok('onboarding_completed', { language: 'mn', level: 'A1', goal: 'general', completionAction: 'practice' }))
      .toMatchObject({ properties: { completionAction: 'practice' } });
    expect(ok('onboarding_completed', { language: 'mn', level: 'A1', goal: 'general', completionAction: 'dashboard' }))
      .toMatchObject({ properties: { completionAction: 'dashboard' } });
  });

  it('accepts seed/topic recommendation types and topic/seed ids', () => {
    expect(
      ok('onboarding_dashboard_skipped', {
        language: 'fa',
        level: 'A1',
        goal: 'conversation',
        recommendationType: 'seed',
      }),
    ).toMatchObject({ properties: { recommendationType: 'seed' } });
    expect(
      ok('onboarding_recommended_practice_started', {
        language: 'mn',
        level: 'A2',
        goal: 'travel',
        recommendationType: 'topic',
        recommendationId: 'topic-travel-mn',
      }),
    ).toMatchObject({ properties: { recommendationId: 'topic-travel-mn' } });
  });
});

describe('validateOnboardingEvent — rejections', () => {
  it('rejects non-object payloads', () => {
    expect(validateOnboardingEvent(null)).toBeNull();
    expect(validateOnboardingEvent('x')).toBeNull();
    expect(validateOnboardingEvent([])).toBeNull();
    expect(validateOnboardingEvent(42)).toBeNull();
    expect(validateOnboardingEvent(undefined)).toBeNull();
  });

  it('rejects unknown event names', () => {
    expect(ok('clicked_button')).toBeNull();
    expect(ok('onboarding_done')).toBeNull();
  });

  it('rejects missing event name', () => {
    expect(validateOnboardingEvent({ properties: {} })).toBeNull();
  });

  it('rejects unknown/extra property keys', () => {
    expect(ok('onboarding_started', { language: 'mn' })).toBeNull();
    expect(ok('onboarding_language_selected', { language: 'mn', extra: 'x' })).toBeNull();
  });

  it('rejects missing required property keys', () => {
    expect(ok('onboarding_level_selected', { language: 'mn' })).toBeNull();
    expect(ok('onboarding_completed', { language: 'mn', level: 'A1', goal: 'general' })).toBeNull();
    expect(ok('onboarding_ready_viewed', { language: 'mn', level: 'A1', goal: 'general' })).toBeNull();
  });

  it('rejects invalid language values', () => {
    expect(ok('onboarding_language_selected', { language: 'xx' })).toBeNull();
    expect(ok('onboarding_language_selected', { language: 'Spanish' })).toBeNull();
    expect(ok('onboarding_language_selected', { language: 'es-ES' })).toBeNull(); // normalized key is es
  });

  it('rejects invalid level values', () => {
    expect(ok('onboarding_level_selected', { language: 'mn', level: 'B3' })).toBeNull();
    expect(ok('onboarding_level_selected', { language: 'mn', level: 'beginner' })).toBeNull();
  });

  it('rejects invalid goal values', () => {
    expect(ok('onboarding_goal_selected', { language: 'mn', level: 'A1', goal: 'fluency' })).toBeNull();
  });

  it('rejects invalid recommendationType values', () => {
    expect(
      ok('onboarding_ready_viewed', {
        language: 'mn',
        level: 'A1',
        goal: 'general',
        recommendationType: 'ai',
        recommendationId: 'bank-full-mn-A1',
      }),
    ).toBeNull();
  });

  it('rejects invalid completionAction values', () => {
    expect(ok('onboarding_completed', { language: 'mn', level: 'A1', goal: 'general', completionAction: 'skip' })).toBeNull();
  });

  it('rejects malformed recommendation ids', () => {
    expect(
      ok('onboarding_ready_viewed', {
        language: 'mn',
        level: 'A1',
        goal: 'general',
        recommendationType: 'cefr',
        recommendationId: 'bank full mn A1', // spaces
      }),
    ).toBeNull();
    expect(
      ok('onboarding_ready_viewed', {
        language: 'mn',
        level: 'A1',
        goal: 'general',
        recommendationType: 'cefr',
        recommendationId: 'x'.repeat(121), // too long
      }),
    ).toBeNull();
    expect(
      ok('onboarding_ready_viewed', {
        language: 'mn',
        level: 'A1',
        goal: 'general',
        recommendationType: 'cefr',
        recommendationId: '',
      }),
    ).toBeNull();
  });

  it('rejects PII-shaped property keys even when otherwise valid', () => {
    expect(ok('onboarding_language_selected', { language: 'mn', email: 'x@y.z' })).toBeNull();
    expect(ok('onboarding_completed', { uid: 'abc', language: 'mn', level: 'A1', goal: 'x', completionAction: 'practice' })).toBeNull();
    expect(ok('onboarding_started', { displayName: 'n', token: 't', password: 'p' })).toBeNull();
    expect(ok('onboarding_started', { user_id: 'x' })).toBeNull();
  });

  it('rejects email-shaped values defensively', () => {
    expect(ok('onboarding_language_selected', { language: 'user@example.com' })).toBeNull();
  });

  it('rejects non-string property values', () => {
    expect(ok('onboarding_language_selected', { language: 5 } as never)).toBeNull();
    expect(ok('onboarding_goal_selected', { language: 'mn', level: 'A1', goal: null } as never)).toBeNull();
  });
});
