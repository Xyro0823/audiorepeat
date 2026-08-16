import { describe, expect, it } from 'vitest';
import { summarizeOnboardingEvents } from '@/lib/analytics/summary';
import type { OnboardingEventPayload } from '@/lib/analytics/events';

const EV = (event: OnboardingEventPayload['event'], properties: Record<string, string>): unknown => ({
  event,
  properties,
});

describe('summarizeOnboardingEvents', () => {
  it('returns an empty, safe summary for no events', () => {
    const s = summarizeOnboardingEvents([], 90);
    expect(s.totalEvents).toBe(0);
    expect(s.started).toBe(0);
    expect(s.completed).toBe(0);
    expect(s.completionPct).toBe(0);
    expect(s.recommendation.total).toBe(0);
    expect(s.completionAction.total).toBe(0);
    expect(s.topLanguages).toEqual([]);
  });

  it('computes started/completed and the completion percentage', () => {
    const events = [
      EV('onboarding_started', {}),
      EV('onboarding_started', {}),
      EV('onboarding_started', {}),
      EV('onboarding_language_selected', { language: 'mn' }),
      EV('onboarding_completed', { language: 'mn', level: 'A1', goal: 'general', completionAction: 'practice' }),
      EV('onboarding_completed', { language: 'mn', level: 'A1', goal: 'general', completionAction: 'practice' }),
    ];
    const s = summarizeOnboardingEvents(events, 30);
    expect(s.windowDays).toBe(30);
    expect(s.started).toBe(3);
    expect(s.completed).toBe(2);
    expect(s.completionPct).toBe(67); // 2/3 rounded
    expect(s.totalEvents).toBe(6);
  });

  it('returns 0% completion when nothing started', () => {
    const s = summarizeOnboardingEvents([EV('onboarding_completed', { language: 'mn', level: 'A1', goal: 'x', completionAction: 'practice' })], 90);
    expect(s.started).toBe(0);
    expect(s.completionPct).toBe(0);
  });

  it('builds the per-step funnel counts (drop-off)', () => {
    const events = [
      EV('onboarding_started', {}),
      EV('onboarding_language_selected', { language: 'mn' }),
      EV('onboarding_level_selected', { language: 'mn', level: 'A1' }),
      EV('onboarding_goal_selected', { language: 'mn', level: 'A1', goal: 'general' }),
      EV('onboarding_ready_viewed', {
        language: 'mn',
        level: 'A1',
        goal: 'general',
        recommendationType: 'cefr',
        recommendationId: 'bank-full-mn-A1',
      }),
      EV('onboarding_completed', { language: 'mn', level: 'A1', goal: 'general', completionAction: 'practice' }),
    ];
    const s = summarizeOnboardingEvents(events, 90);
    expect(s.stepCounts.onboarding_started).toBe(1);
    expect(s.stepCounts.onboarding_language_selected).toBe(1);
    expect(s.stepCounts.onboarding_level_selected).toBe(1);
    expect(s.stepCounts.onboarding_goal_selected).toBe(1);
    expect(s.stepCounts.onboarding_ready_viewed).toBe(1);
    expect(s.stepCounts.onboarding_completed).toBe(1);
    expect(s.stepCounts.onboarding_dashboard_skipped).toBe(0);
  });

  it('aggregates top languages/levels/goals by selection events', () => {
    const events = [
      EV('onboarding_language_selected', { language: 'mn' }),
      EV('onboarding_language_selected', { language: 'mn' }),
      EV('onboarding_language_selected', { language: 'es' }),
      EV('onboarding_level_selected', { language: 'mn', level: 'A1' }),
      EV('onboarding_level_selected', { language: 'mn', level: 'B2' }),
      EV('onboarding_goal_selected', { language: 'mn', level: 'A1', goal: 'travel' }),
      EV('onboarding_goal_selected', { language: 'mn', level: 'B2', goal: 'work' }),
      EV('onboarding_goal_selected', { language: 'mn', level: 'B2', goal: 'work' }),
    ];
    const s = summarizeOnboardingEvents(events, 90);
    expect(s.topLanguages[0]).toEqual({ value: 'mn', count: 2 });
    expect(s.topLanguages[1]).toEqual({ value: 'es', count: 1 });
    // Equal counts tie-break alphabetically (deterministic).
    expect(s.topLevels[0]).toEqual({ value: 'A1', count: 1 });
    expect(s.topLevels[1]).toEqual({ value: 'B2', count: 1 });
    expect(s.topGoals[0]).toEqual({ value: 'work', count: 2 });
    expect(s.topGoals[1]).toEqual({ value: 'travel', count: 1 });
  });

  it('splits recommendation types from ready_viewed events', () => {
    const events = [
      EV('onboarding_ready_viewed', { language: 'mn', level: 'A1', goal: 'general', recommendationType: 'cefr', recommendationId: 'bank-full-mn-A1' }),
      EV('onboarding_ready_viewed', { language: 'mn', level: 'A2', goal: 'general', recommendationType: 'topic', recommendationId: 'topic-travel-mn' }),
      EV('onboarding_ready_viewed', { language: 'fa', level: 'A1', goal: 'general', recommendationType: 'seed', recommendationId: 'seed-persian-basics' }),
      EV('onboarding_ready_viewed', { language: 'mn', level: 'A1', goal: 'general', recommendationType: 'cefr', recommendationId: 'bank-full-mn-A1' }),
    ];
    const s = summarizeOnboardingEvents(events, 90);
    expect(s.recommendation).toMatchObject({ cefr: 2, topic: 1, seed: 1, total: 4, cefrPct: 50, topicPct: 25, seedPct: 25 });
  });

  it('splits completion actions from completed events', () => {
    const events = [
      EV('onboarding_completed', { language: 'mn', level: 'A1', goal: 'general', completionAction: 'practice' }),
      EV('onboarding_completed', { language: 'mn', level: 'A1', goal: 'general', completionAction: 'practice' }),
      EV('onboarding_completed', { language: 'mn', level: 'A1', goal: 'general', completionAction: 'dashboard' }),
    ];
    const s = summarizeOnboardingEvents(events, 90);
    expect(s.completionAction).toMatchObject({ practice: 2, dashboard: 1, total: 3, practicePct: 67, dashboardPct: 33 });
  });

  it('skips invalid payloads defensively', () => {
    const events = [
      EV('onboarding_started', {}),
      EV('onboarding_started', { bogus: 'x' }),
      EV('not_an_event' as never, {}),
      null,
      { event: 'onboarding_completed', properties: { language: 'mn', level: 'A1', goal: 'g', completionAction: 'skip' } },
    ];
    const s = summarizeOnboardingEvents(events, 90);
    expect(s.totalEvents).toBe(1);
    expect(s.started).toBe(1);
  });
});
