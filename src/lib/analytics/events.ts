/**
 * Onboarding analytics — typed event model.
 *
 * Privacy-first by construction:
 *   - NO uid, email, display name, token, vocabulary content, or any other PII
 *     is ever part of a payload (see validateOnboardingEvent — the property
 *     allowlist per event is the ONLY accepted shape, and PII-shaped keys are
 *     rejected defensively).
 *   - Events are aggregate/product telemetry only. The client authenticates
 *     the POST with a Firebase ID token (Bearer) so the server can reject
 *     anonymous spam, but the server NEVER stores the uid — it is used only
 *     for verification and discarded.
 *
 * This module is shared by the browser (builds payloads) and the server
 * (validates before storing), so the schema cannot drift between sides.
 */
import { FREE_LANG_OPTIONS } from '@/lib/freeLang';
import { CEFR_LEVELS } from '@/types/app';

export const ONBOARDING_EVENT_NAMES = [
  'onboarding_started',
  'onboarding_language_selected',
  'onboarding_level_selected',
  'onboarding_goal_selected',
  'onboarding_ready_viewed',
  'onboarding_recommended_practice_started',
  'onboarding_dashboard_skipped',
  'onboarding_completed',
] as const;

export type OnboardingEventName = (typeof ONBOARDING_EVENT_NAMES)[number];

/** Every language the picker offers — the only accepted `language` values. */
export const ONBOARDING_LANGUAGE_KEYS: readonly string[] = FREE_LANG_OPTIONS.map((o) => o.key);

export const ONBOARDING_LEVEL_IDS: readonly string[] = [...CEFR_LEVELS];

// Kept inline (not imported from lib/onboarding) to avoid a module cycle:
// onboarding.ts imports the analytics client, which imports events.ts. A
// regression test pins this list to ONBOARDING_GOALS so it cannot drift.
export const ONBOARDING_GOAL_IDS: readonly string[] = [
  'conversation',
  'travel',
  'study',
  'work',
  'vocabulary',
  'general',
];

export const RECOMMENDATION_TYPES = ['cefr', 'topic', 'seed'] as const;
export type RecommendationType = (typeof RECOMMENDATION_TYPES)[number];

export const COMPLETION_ACTIONS = ['practice', 'dashboard'] as const;
export type CompletionAction = (typeof COMPLETION_ACTIONS)[number];

/**
 * Per-event property schemas. Each event's listed keys are REQUIRED (no
 * optional fields) and no other key is accepted — this is the single source
 * of truth for both the typed client builder and the server validator.
 */
interface OnboardingPropertyMap {
  onboarding_started: Record<string, never>;
  onboarding_language_selected: { language: string };
  onboarding_level_selected: { language: string; level: string };
  onboarding_goal_selected: { language: string; level: string; goal: string };
  onboarding_ready_viewed: {
    language: string;
    level: string;
    goal: string;
    recommendationType: RecommendationType;
    recommendationId: string;
  };
  onboarding_recommended_practice_started: {
    language: string;
    level: string;
    goal: string;
    recommendationType: RecommendationType;
    recommendationId: string;
  };
  onboarding_dashboard_skipped: {
    language: string;
    level: string;
    goal: string;
    recommendationType: RecommendationType;
  };
  onboarding_completed: { language: string; level: string; goal: string; completionAction: CompletionAction };
}

export type OnboardingEventProperties<N extends OnboardingEventName = OnboardingEventName> =
  OnboardingPropertyMap[N];

export type OnboardingEventPayload = {
  [N in OnboardingEventName]: { event: N; properties: OnboardingPropertyMap[N] };
}[OnboardingEventName];

const EVENT_PROP_KEYS: Record<OnboardingEventName, readonly string[]> = {
  onboarding_started: [],
  onboarding_language_selected: ['language'],
  onboarding_level_selected: ['language', 'level'],
  onboarding_goal_selected: ['language', 'level', 'goal'],
  onboarding_ready_viewed: ['language', 'level', 'goal', 'recommendationType', 'recommendationId'],
  onboarding_recommended_practice_started: [
    'language',
    'level',
    'goal',
    'recommendationType',
    'recommendationId',
  ],
  onboarding_dashboard_skipped: ['language', 'level', 'goal', 'recommendationType'],
  onboarding_completed: ['language', 'level', 'goal', 'completionAction'],
};

const LANG_KEYS = new Set<string>(ONBOARDING_LANGUAGE_KEYS);
const LEVEL_IDS = new Set<string>(ONBOARDING_LEVEL_IDS);
const GOAL_IDS = new Set<string>(ONBOARDING_GOAL_IDS);
const REC_TYPES = new Set<string>(RECOMMENDATION_TYPES);
const ACTIONS = new Set<string>(COMPLETION_ACTIONS);

/** Conservative shape for recommendation ids (seed-/bank-/topic- set ids). */
const RECOMMENDATION_ID_RE = /^[A-Za-z0-9][A-Za-z0-9-]{0,119}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** PII-shaped property keys are never accepted, regardless of event. */
const PII_KEY_RE = /(email|uid|user|display|token|password|secret|phone|name\b)/i;

function isString(v: unknown): v is string {
  return typeof v === 'string';
}

function isValidProperty(event: OnboardingEventName, key: string, value: unknown): boolean {
  if (PII_KEY_RE.test(key)) return false;
  if (!isString(value)) return false;
  switch (key) {
    case 'language':
      return LANG_KEYS.has(value);
    case 'level':
      return LEVEL_IDS.has(value);
    case 'goal':
      return GOAL_IDS.has(value);
    case 'recommendationType':
      return REC_TYPES.has(value);
    case 'recommendationId':
      return RECOMMENDATION_ID_RE.test(value);
    case 'completionAction':
      return ACTIONS.has(value);
    default:
      return false;
  }
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Validate an incoming event payload. Returns the canonical event (event name
 * + string-keyed properties) or null when anything is off:
 *   - unknown event name → reject
 *   - unknown/extra property keys → reject (this alone blocks PII fields)
 *   - missing required keys → reject
 *   - invalid property values (wrong language/level/goal/type/action) → reject
 *   - PII-shaped keys or email-shaped values → reject (defense in depth)
 *
 * Used by the browser (buildOnboardingEvent) and the server route — the server
 * only stores events that pass here, so the data model stays narrow and
 * append-only.
 */
export function validateOnboardingEvent(payload: unknown): OnboardingEventPayload | null {
  if (!isPlainObject(payload)) return null;
  const { event, properties } = payload;
  if (!isString(event)) return null;
  if (!(ONBOARDING_EVENT_NAMES as readonly string[]).includes(event)) return null;
  const name = event as OnboardingEventName;
  const props = properties === undefined ? {} : properties;
  if (!isPlainObject(props)) return null;
  const allowed = EVENT_PROP_KEYS[name];
  const keys = Object.keys(props);
  if (keys.length !== allowed.length) return null;
  for (const key of keys) {
    if (!allowed.includes(key)) return null;
  }
  const out: Record<string, string> = {};
  for (const key of allowed) {
    const value = props[key];
    if (!isValidProperty(name, key, value)) return null;
    if (!isString(value)) return null;
    // Defense in depth: even a validated string must not look like an email.
    if (EMAIL_RE.test(value)) return null;
    out[key] = value;
  }
  // `out` is guaranteed to match the event's schema (keys + validators above),
  // so the discriminated-union cast is safe.
  return { event: name, properties: out } as OnboardingEventPayload;
}
