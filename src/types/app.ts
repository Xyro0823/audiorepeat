import type { LoopSettings } from './loop';
import type { PlanId } from '@/lib/plans';

export const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;
export type CefrLevel = (typeof CEFR_LEVELS)[number];

/** Spaced-repetition status for a single word; absent = still learning. */
export type MasteryStatus = 'mastered' | 'hard';

/** App-wide color scheme. */
export type ThemeName = 'neon' | 'dark' | 'light';

export interface VocabWord {
  id: string;
  target: string;
  translation: string;
  repeats?: number; // per-word override; falls back to settings.repeats
  /** 'mastered' = known, 'hard' = review needed; undefined = learning. */
  mastery?: MasteryStatus;
  /** Optional example sentence shown on the word card when enabled in settings. */
  example?: string;
}

export interface VocabSet {
  id: string;
  name: string;
  lang: string; // BCP-47 target language, e.g. "es-ES"
  nativeLang: string; // BCP-47 for translations, e.g. "en-US"
  words: VocabWord[];
  /** Per-set overrides, merged over the global AppSettings. */
  settings?: Partial<AppSettings>;
  /** Optional CEFR difficulty level (A1-C2), e.g. for starter-library sets. */
  cefr?: CefrLevel;
  createdAt: number;
  updatedAt: number;
}

export interface AppSettings extends LoopSettings {
  /** Purchased membership plan — 'basic' (free) until a verified checkout lands. */
  plan: PlanId;
  /** Billing cycle for the plan; only meaningful for paid plans. */
  planBilling: 'monthly' | 'annual';
  /**
   * Where the plan came from — 'manual' (server-admin gift) vs 'paddle'
   * (verified billing) vs null (free/unknown). Mirrored from
   * /api/entitlement's `source`; used only for neutral display copy
   * ("Pro · Gift access" instead of a price the user never paid).
   */
  planSource: 'manual' | 'paddle' | null;
  /**
   * Languages hidden by a Free-plan downgrade (normalized codes, e.g. "es").
   * Sets in these languages are filtered from the UI but NOT deleted — they
   * return automatically when the user upgrades again.
   *
   * Storage: for SIGNED-IN users these two entitlement fields actually live in
   * a per-uid record (lib/accountPrefs — localStorage
   * `audiorepeat-account-prefs:<uid>`), so one account's choice can never
   * leak to another account on the same device. The fields here are the GUEST
   * / legacy fallback (the device-global settings record): guests keep the
   * pre-account behavior exactly, and a signed-in uid's first activation
   * one-time adopts the global hiddenLangs (skipped for pending onboarding).
   */
  hiddenLangs: string[];
  /**
   * The Free user's chosen included language, stored as the normalized
   * pack-level key (same convention as hiddenLangs / planGate.langLimitKey,
   * e.g. "es", "mn"). null = not chosen yet — the legacy fallback rule in
   * planGate.canUseLang applies until the user (or migration) picks one.
   * Pro/Lifetime users are unaffected by this value.
   *
   * Storage: same account-scoping as hiddenLangs — per-uid record for
   * signed-in users (lib/accountPrefs), global settings record for guests.
   * Never shipped to production before this feature, so no production value
   * ever needs migrating.
   */
  selectedFreeLang: string | null;
  cachedAudio: boolean; // prefer pre-generated cached audio (offline) when available
  /** Show contextual emoji hints on word cards. */
  showHints: boolean;
  /** App-wide color scheme: 'neon' (default), 'dark' (muted), 'light' (minimal). */
  theme: ThemeName;
  /** Show per-word example sentences on the word card when a word has one. */
  showExamples: boolean;
  /** Daily practice reminder via the service worker (Notification Triggers). */
  reminderEnabled: boolean;
  /** Reminder time as "HH:MM" in the device's local timezone. */
  reminderTime: string;
}

export const DEFAULT_SETTINGS: AppSettings = {
  repeats: 2,
  speed: 1,
  targetGapMs: 1000,
  translationGapMs: 900,
  loop: true,
  plan: 'basic',
  planBilling: 'annual',
  planSource: null,
  hiddenLangs: [],
  selectedFreeLang: null,
  cachedAudio: false,
  showHints: true,
  theme: 'neon',
  showExamples: true,
  reminderEnabled: false,
  reminderTime: '09:00',
};
