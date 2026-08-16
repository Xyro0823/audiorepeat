import type { CefrLevel, VocabSet } from '@/types/app';
import type { GoalId } from '@/lib/onboarding';
import { ONBOARDING_GOALS } from '@/lib/onboarding';
import { seedSetForLang } from '@/lib/seedSets';
import { PACK_LANG, packLangLabel, starterLangLabel } from '@/lib/starterSets';
import { loadTopic, loadWordBank } from '@/lib/vocab/wordBanks';
import type { TopicManifest, WordBankManifest } from '@/lib/vocab/wordBanks';

/**
 * Personalized first-session recommendation shown on the onboarding Ready step.
 *
 * Deterministic, data-driven, no AI: it picks the most relevant starter content
 * from the user's language + CEFR level + goal, and ALWAYS returns something
 * the user can practice (never dead-ends). Pure decision logic lives here so it
 * can be unit-tested without the network; the async build/start plumbing that
 * turns a recommendation into a real set lives beside it.
 */

/** Goal → topic id (only goals with an obvious topic get one). */
export const GOAL_TOPIC: Partial<Record<GoalId, string>> = {
  conversation: 'smalltalk',
  travel: 'travel',
  study: 'education',
  work: 'business',
};

export type FirstPracticeRecommendation =
  | { type: 'cefr'; lang: string; level: CefrLevel; title: string; reason: string }
  | { type: 'topic'; lang: string; topicId: string; title: string; reason: string }
  | { type: 'seed'; lang: string; title: string; reason: string };

export interface RecommendFirstPracticeInput {
  /** Normalized pack-level language key (planGate/freeLang convention). */
  lang: string;
  /** Chosen CEFR level (A1–C2). */
  level: CefrLevel;
  /** Chosen onboarding goal. */
  goal: GoalId;
  /** Vocab manifest (pack code → level counts), or null when unavailable. */
  availableBanks: WordBankManifest | null;
  /** Topic manifest (topic id → languages), or null when unavailable. */
  availableTopics: TopicManifest | null;
}

function goalLabel(goal: GoalId): string {
  return ONBOARDING_GOALS.find((o) => o.id === goal)?.label ?? goal;
}

/**
 * Pure recommendation. Resolution order per goal:
 *
 *   conversation/travel/study/work → matching topic (when the language has it)
 *                                    → selected CEFR level → seed
 *   vocabulary                     → selected CEFR level → seed
 *   general                        → selected CEFR level → A1 → seed
 *
 * The selected level is honored exactly whenever the language's bank has it —
 * a B2 learner is never silently dropped to A1 (except the explicit A1 fallback
 * for "general"). Seed-only languages always fall back to their curated seed.
 */
export function recommendFirstPractice(
  input: RecommendFirstPracticeInput,
): FirstPracticeRecommendation {
  const { lang, level, goal, availableBanks, availableTopics } = input;
  const label = packLangLabel(lang);
  const hasLevel = (l: CefrLevel): boolean =>
    !!availableBanks?.[lang]?.[l] && (availableBanks[lang][l] ?? 0) > 0;

  // Goal-aligned topic (only when this language ships that topic).
  const topicId = GOAL_TOPIC[goal];
  if (topicId && availableTopics?.[topicId]?.langs?.[lang]) {
    return {
      type: 'topic',
      lang,
      topicId,
      title: `${availableTopics[topicId].label} · ${label}`,
      reason: `Based on your ${goalLabel(goal)} goal`,
    };
  }

  // Selected CEFR level — honored exactly when available.
  if (hasLevel(level)) {
    return {
      type: 'cefr',
      lang,
      level,
      title: goal === 'vocabulary' ? `${label} ${level} Vocabulary` : `${label} ${level}`,
      reason: `Based on your ${level} level`,
    };
  }

  // "General practice" may step down to A1 (still real bank content).
  if (goal === 'general' && level !== 'A1' && hasLevel('A1')) {
    return {
      type: 'cefr',
      lang,
      level: 'A1',
      title: `${label} A1`,
      reason: 'Based on your A1 level',
    };
  }

  // Curated seed — always available for every picker language.
  const seed = seedSetForLang(lang);
  if (seed) {
    return { type: 'seed', lang, title: seed.name, reason: 'Starting with essential basics' };
  }
  // Defensive last resort (every picker language has a seed): never dead-end.
  return { type: 'seed', lang, title: label, reason: 'Starting with essential basics' };
}

/**
 * The canonical set id a recommendation points at (topic-/bank-full-/seed-
 * card conventions). Used by analytics and by findRecommendedSet's fallback
 * id, so reporting and idempotency can never drift from the recommendation.
 */
export function recommendationIdOf(rec: FirstPracticeRecommendation): string {
  if (rec.type === 'topic') return `topic-${rec.topicId}-${rec.lang}`;
  if (rec.type === 'cefr') return `bank-full-${rec.lang}-${rec.level}`;
  return seedSetForLang(rec.lang)?.id ?? '';
}

/**
 * An existing set that already covers this recommendation (idempotency): a
 * hydrated seed card for the same pack+level, a full-level bank card, or the
 * deterministic topic card. Start must reuse it instead of duplicating.
 */
export function findRecommendedSet(
  existing: VocabSet[],
  rec: FirstPracticeRecommendation,
): VocabSet | null {
  if (rec.type === 'seed') {
    const id = seedSetForLang(rec.lang)?.id;
    return id ? (existing.find((s) => s.id === id) ?? null) : null;
  }
  if (rec.type === 'topic') {
    const id = `topic-${rec.topicId}-${rec.lang}`;
    return existing.find((s) => s.id === id) ?? null;
  }
  // cefr: a seed card hydrated for this exact pack+level, or a bank-full card.
  for (const s of existing) {
    if (s.id.startsWith('seed-') && s.cefr === rec.level && (PACK_LANG[s.lang] ?? s.lang) === rec.lang) {
      return s;
    }
  }
  const id = `bank-full-${rec.lang}-${rec.level}`;
  return existing.find((s) => s.id === id) ?? null;
}

/**
 * Build the set a recommendation points at (topic or CEFR level). Returns null
 * when the underlying data cannot be loaded — callers then fall back to the
 * curated seed, so a start action never dead-ends. Seed recommendations are
 * handled by the caller (the starter set is seeded separately).
 */
export async function buildRecommendedSet(
  rec: FirstPracticeRecommendation,
): Promise<VocabSet | null> {
  const now = Date.now();
  if (rec.type === 'topic') {
    const data = await loadTopic(rec.topicId);
    const words = data?.[rec.lang];
    if (!words || words.length === 0) return null;
    return {
      id: `topic-${rec.topicId}-${rec.lang}`,
      name: `${packLangLabel(rec.lang)} · ${rec.topicId} (${words.length} words)`,
      lang: rec.lang,
      nativeLang: 'en-US',
      words: words.map(([target, translation], i) => ({
        id: `tp-${now}-${i}`,
        target,
        translation,
      })),
      createdAt: now,
      updatedAt: now,
    };
  }
  if (rec.type === 'cefr') {
    const bank = await loadWordBank(rec.lang, rec.level);
    if (!bank || bank.words.length === 0) return null;
    return {
      id: `bank-full-${rec.lang}-${rec.level}`,
      name: `${starterLangLabel(rec.lang)} ${rec.level} · full level (${bank.words.length.toLocaleString()} words)`,
      lang: rec.lang,
      nativeLang: 'en-US',
      words: bank.words.map(([target, translation], i) => ({
        id: `bkf-${now}-${i}`,
        target,
        translation,
      })),
      cefr: rec.level,
      createdAt: now,
      updatedAt: now,
    };
  }
  return null;
}
