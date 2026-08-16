/**
 * Onboarding analytics — admin summary aggregation (pure, unit-tested).
 *
 * Events are aggregate product telemetry (never per-user, no uid anywhere),
 * so the summary is computed by counting event docs. Drop-off is answered at
 * the funnel level: `stepCounts` shows how many events reached each step, so
 * started → language → level → goal → ready → completed gaps reveal where
 * users leave.
 */
import {
  ONBOARDING_EVENT_NAMES,
  validateOnboardingEvent,
  type OnboardingEventName,
  type OnboardingEventPayload,
} from '@/lib/analytics/events';

export interface TopItem {
  value: string;
  count: number;
}

export interface OnboardingSummary {
  windowDays: number;
  totalEvents: number;
  started: number;
  completed: number;
  completionPct: number;
  stepCounts: Record<OnboardingEventName, number>;
  topLanguages: TopItem[];
  topLevels: TopItem[];
  topGoals: TopItem[];
  recommendation: {
    cefr: number;
    topic: number;
    seed: number;
    total: number;
    cefrPct: number;
    topicPct: number;
    seedPct: number;
  };
  completionAction: {
    practice: number;
    dashboard: number;
    total: number;
    practicePct: number;
    dashboardPct: number;
  };
}

function pct(part: number, total: number): number {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}

function top(values: string[], limit = 10): TopItem[] {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value))
    .slice(0, limit);
}

/**
 * Aggregate validated event payloads into the admin summary. Invalid payloads
 * are skipped defensively (the POST route validates on write, but a stored doc
 * should never corrupt the report).
 */
export function summarizeOnboardingEvents(events: unknown[], windowDays: number): OnboardingSummary {
  const stepCounts = Object.fromEntries(
    ONBOARDING_EVENT_NAMES.map((n) => [n, 0]),
  ) as Record<OnboardingEventName, number>;

  const languages: string[] = [];
  const levels: string[] = [];
  const goals: string[] = [];
  let recCefr = 0;
  let recTopic = 0;
  let recSeed = 0;
  let actionPractice = 0;
  let actionDashboard = 0;

  for (const raw of events) {
    const payload = validateOnboardingEvent(raw) as OnboardingEventPayload | null;
    if (!payload) continue;
    stepCounts[payload.event] += 1;
    switch (payload.event) {
      case 'onboarding_language_selected':
        languages.push(payload.properties.language);
        break;
      case 'onboarding_level_selected':
        levels.push(payload.properties.level);
        break;
      case 'onboarding_goal_selected':
        goals.push(payload.properties.goal);
        break;
      case 'onboarding_ready_viewed':
        if (payload.properties.recommendationType === 'cefr') recCefr += 1;
        else if (payload.properties.recommendationType === 'topic') recTopic += 1;
        else recSeed += 1;
        break;
      case 'onboarding_completed':
        if (payload.properties.completionAction === 'practice') actionPractice += 1;
        else actionDashboard += 1;
        break;
      default:
        break;
    }
  }

  const started = stepCounts.onboarding_started;
  const completed = stepCounts.onboarding_completed;
  const recTotal = recCefr + recTopic + recSeed;
  const actionTotal = actionPractice + actionDashboard;
  const totalEvents = Object.values(stepCounts).reduce((a, b) => a + b, 0);

  return {
    windowDays,
    totalEvents,
    started,
    completed,
    completionPct: pct(completed, started),
    stepCounts,
    topLanguages: top(languages),
    topLevels: top(levels),
    topGoals: top(goals),
    recommendation: {
      cefr: recCefr,
      topic: recTopic,
      seed: recSeed,
      total: recTotal,
      cefrPct: pct(recCefr, recTotal),
      topicPct: pct(recTopic, recTotal),
      seedPct: pct(recSeed, recTotal),
    },
    completionAction: {
      practice: actionPractice,
      dashboard: actionDashboard,
      total: actionTotal,
      practicePct: pct(actionPractice, actionTotal),
      dashboardPct: pct(actionDashboard, actionTotal),
    },
  };
}
