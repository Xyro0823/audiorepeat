import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  buildRecommendedSet,
  findRecommendedSet,
  recommendFirstPractice,
  type FirstPracticeRecommendation,
} from '@/lib/firstPractice';
import { loadTopic, loadWordBank } from '@/lib/vocab/wordBanks';
import type { CefrLevel, VocabSet } from '@/types/app';

vi.mock('@/lib/vocab/wordBanks', () => ({
  loadTopic: vi.fn(),
  loadWordBank: vi.fn(),
}));

const ALL_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;

/** A word-bank manifest with the given level counts (default full A1–C2). */
function banks(overrides: Record<string, Partial<Record<CefrLevel, number>>> = {}): Record<
  string,
  Partial<Record<CefrLevel, number>>
> {
  const full: Record<string, Partial<Record<CefrLevel, number>>> = {};
  for (const lang of ['es', 'fr', 'mn', 'xx']) {
    full[lang] = Object.fromEntries(ALL_LEVELS.map((l) => [l, 100])) as Record<CefrLevel, number>;
  }
  return { ...full, ...overrides };
}

const TOPIC_MANIFEST = {
  smalltalk: { label: 'Small Talk', emoji: '💬', langs: { es: 50, fr: 50, mn: 50, xx: 50 } },
  travel: { label: 'Travel & Airport', emoji: '🧳', langs: { es: 50, fr: 50, mn: 50, xx: 50 } },
  education: { label: 'Education & School', emoji: '🎓', langs: { es: 50, fr: 50, mn: 50, xx: 50 } },
  business: { label: 'Business & Work', emoji: '💼', langs: { es: 50, fr: 50, mn: 50, xx: 50 } },
};

/** Minimal set stub. */
function setOf(partial: Partial<VocabSet>): VocabSet {
  return {
    id: 'x',
    name: 'x',
    lang: 'mn',
    nativeLang: 'en-US',
    words: [],
    createdAt: 0,
    updatedAt: 0,
    ...partial,
  };
}

const inputs = {
  mn: { lang: 'mn', level: 'A1' as CefrLevel, availableBanks: banks(), availableTopics: TOPIC_MANIFEST },
};

describe('recommendFirstPractice — goal → content mapping', () => {
  it('Conversation → smalltalk topic', () => {
    const rec = recommendFirstPractice({ ...inputs.mn, goal: 'conversation' });
    expect(rec.type).toBe('topic');
    if (rec.type === 'topic') {
      expect(rec.topicId).toBe('smalltalk');
      expect(rec.lang).toBe('mn');
      expect(rec.reason).toContain('Conversation');
    }
  });

  it('Travel → travel topic', () => {
    const rec = recommendFirstPractice({ ...inputs.mn, goal: 'travel' });
    expect(rec.type).toBe('topic');
    if (rec.type === 'topic') expect(rec.topicId).toBe('travel');
  });

  it('School / Study → education topic', () => {
    const rec = recommendFirstPractice({ ...inputs.mn, goal: 'study' });
    expect(rec.type).toBe('topic');
    if (rec.type === 'topic') expect(rec.topicId).toBe('education');
  });

  it('Work → business topic', () => {
    const rec = recommendFirstPractice({ ...inputs.mn, goal: 'work' });
    expect(rec.type).toBe('topic');
    if (rec.type === 'topic') expect(rec.topicId).toBe('business');
  });

  it('Vocabulary → selected CEFR level (no topic path)', () => {
    const rec = recommendFirstPractice({ ...inputs.mn, goal: 'vocabulary' });
    expect(rec.type).toBe('cefr');
    if (rec.type === 'cefr') {
      expect(rec.level).toBe('A1');
      expect(rec.reason).toContain('A1 level');
    }
  });

  it('General practice → selected CEFR level', () => {
    const rec = recommendFirstPractice({ ...inputs.mn, goal: 'general' });
    expect(rec.type).toBe('cefr');
    if (rec.type === 'cefr') expect(rec.level).toBe('A1');
  });
});

describe('recommendFirstPractice — level honoring & fallbacks', () => {
  it('keeps the selected B2 when the bank has it (no silent downgrade)', () => {
    const rec = recommendFirstPractice({
      lang: 'mn',
      level: 'B2',
      goal: 'vocabulary',
      availableBanks: banks(),
      availableTopics: null,
    });
    expect(rec.type).toBe('cefr');
    if (rec.type === 'cefr') expect(rec.level).toBe('B2');
  });

  it('keeps C1 for a topic goal when the topic is missing (falls back to CEFR)', () => {
    const rec = recommendFirstPractice({
      lang: 'mn',
      level: 'C1',
      goal: 'travel',
      availableBanks: banks(),
      // no topics at all → CEFR fallback keeps C1
      availableTopics: null,
    });
    expect(rec.type).toBe('cefr');
    if (rec.type === 'cefr') expect(rec.level).toBe('C1');
  });

  it('missing topic → falls back to the selected CEFR level', () => {
    const noTravel = Object.fromEntries(
      Object.entries(TOPIC_MANIFEST).filter(([id]) => id !== 'travel'),
    ) as typeof TOPIC_MANIFEST;
    const rec = recommendFirstPractice({
      lang: 'mn',
      level: 'A2',
      goal: 'travel',
      availableBanks: banks(),
      availableTopics: noTravel,
    });
    expect(rec.type).toBe('cefr');
    if (rec.type === 'cefr') expect(rec.level).toBe('A2');
  });

  it('missing CEFR level → seed fallback (Vocabulary never downgrades)', () => {
    // Bank exists but only A1; user picked B2 with Vocabulary → seed, not A1.
    const rec = recommendFirstPractice({
      lang: 'mn',
      level: 'B2',
      goal: 'vocabulary',
      availableBanks: banks({ mn: { A1: 100 } }),
      availableTopics: null,
    });
    expect(rec.type).toBe('seed');
    if (rec.type === 'seed') expect(rec.title).toBe('Mongolian Basics');
  });

  it('General practice may step down to A1 when the selected level is missing', () => {
    const rec = recommendFirstPractice({
      lang: 'mn',
      level: 'B2',
      goal: 'general',
      availableBanks: banks({ mn: { A1: 100 } }),
      availableTopics: null,
    });
    expect(rec.type).toBe('cefr');
    if (rec.type === 'cefr') expect(rec.level).toBe('A1');
  });

  it('seed-only language (no banks, no topics) → curated seed', () => {
    const rec = recommendFirstPractice({
      lang: 'fa',
      level: 'A1',
      goal: 'travel',
      availableBanks: null,
      availableTopics: null,
    });
    expect(rec.type).toBe('seed');
    if (rec.type === 'seed') expect(rec.title).toBe('Persian Basics');
  });

  it('topic-capable seed-only language (Dutch) uses its topic', () => {
    const dutchTravel = {
      ...TOPIC_MANIFEST,
      travel: { label: 'Travel & Airport', emoji: '🧳', langs: { nl: 40 } },
    };
    const rec = recommendFirstPractice({
      lang: 'nl',
      level: 'A1',
      goal: 'travel',
      availableBanks: null,
      availableTopics: dutchTravel,
    });
    expect(rec.type).toBe('topic');
    if (rec.type === 'topic') expect(rec.topicId).toBe('travel');
  });

  it('stays in the user’s selected language — never a Pro-locked second language', () => {
    for (const goal of ['conversation', 'travel', 'study', 'work', 'vocabulary', 'general'] as const) {
      const rec = recommendFirstPractice({ ...inputs.mn, goal });
      expect(rec.lang).toBe('mn');
    }
  });

  it('is deterministic for identical inputs', () => {
    const a = recommendFirstPractice({ ...inputs.mn, goal: 'travel' });
    const b = recommendFirstPractice({ ...inputs.mn, goal: 'travel' });
    expect(a).toEqual(b);
  });

  it('never returns a recommendation without a title and reason', () => {
    for (const goal of ['conversation', 'travel', 'study', 'work', 'vocabulary', 'general'] as const) {
      for (const level of ALL_LEVELS) {
        const rec = recommendFirstPractice({
          lang: 'fa',
          level,
          goal,
          availableBanks: null,
          availableTopics: null,
        });
        expect(rec.title.trim().length).toBeGreaterThan(0);
        expect(rec.reason.trim().length).toBeGreaterThan(0);
      }
    }
  });
});

describe('findRecommendedSet — idempotent start (no duplicates)', () => {
  it('reuses the hydrated seed card for a CEFR A1 recommendation', () => {
    const seed = setOf({ id: 'seed-mongolian-basics', lang: 'mn', cefr: 'A1' });
    const rec = recommendFirstPractice({ ...inputs.mn, goal: 'general' });
    expect(findRecommendedSet([seed], rec)?.id).toBe('seed-mongolian-basics');
  });

  it('reuses an existing bank-full card for a higher CEFR level', () => {
    const existing = setOf({ id: 'bank-full-mn-B2', lang: 'mn', cefr: 'B2' });
    const rec = recommendFirstPractice({
      lang: 'mn',
      level: 'B2',
      goal: 'vocabulary',
      availableBanks: banks(),
      availableTopics: null,
    });
    expect(findRecommendedSet([existing], rec)?.id).toBe('bank-full-mn-B2');
  });

  it('reuses the deterministic topic card', () => {
    const existing = setOf({ id: 'topic-travel-mn', lang: 'mn' });
    const rec = recommendFirstPractice({ ...inputs.mn, goal: 'travel' });
    expect(findRecommendedSet([existing], rec)?.id).toBe('topic-travel-mn');
  });

  it('returns null when nothing exists yet (caller builds it once)', () => {
    const rec = recommendFirstPractice({ ...inputs.mn, goal: 'travel' });
    expect(findRecommendedSet([], rec)).toBeNull();
    const cefrRec = recommendFirstPractice({ ...inputs.mn, goal: 'vocabulary', level: 'B1' });
    expect(findRecommendedSet([], cefrRec)).toBeNull();
  });

  it('seed recommendation finds the seed set by its stable id', () => {
    const seed = setOf({ id: 'seed-persian-basics', lang: 'fa' });
    const rec = recommendFirstPractice({
      lang: 'fa',
      level: 'A1',
      goal: 'travel',
      availableBanks: null,
      availableTopics: null,
    });
    expect(findRecommendedSet([seed], rec)?.id).toBe('seed-persian-basics');
  });
});

describe('buildRecommendedSet', () => {
  beforeEach(() => {
    vi.mocked(loadTopic).mockReset();
    vi.mocked(loadWordBank).mockReset();
  });

  it('builds a topic card with the deterministic id and display name', async () => {
    vi.mocked(loadTopic).mockResolvedValue({ mn: [['нэг', 'one'], ['хоёр', 'two']] });
    const rec: FirstPracticeRecommendation = {
      type: 'topic',
      lang: 'mn',
      topicId: 'travel',
      title: 'Travel & Airport · Mongolian',
      reason: 'Based on your Travel goal',
    };
    const set = await buildRecommendedSet(rec);
    expect(set?.id).toBe('topic-travel-mn');
    expect(set?.lang).toBe('mn');
    expect(set?.words.length).toBe(2);
    expect(set?.name).toContain('travel');
  });

  it('builds a CEFR full-level card with the bank’s words', async () => {
    vi.mocked(loadWordBank).mockResolvedValue({
      lang: 'mn',
      level: 'B1',
      words: [['ажил', 'work'], ['худалдаа', 'trade']],
    });
    const rec: FirstPracticeRecommendation = {
      type: 'cefr',
      lang: 'mn',
      level: 'B1',
      title: 'Mongolian B1',
      reason: 'Based on your B1 level',
    };
    const set = await buildRecommendedSet(rec);
    expect(set?.id).toBe('bank-full-mn-B1');
    expect(set?.cefr).toBe('B1');
    expect(set?.words.length).toBe(2);
  });

  it('returns null when the topic data cannot be loaded (caller falls back to seed)', async () => {
    vi.mocked(loadTopic).mockResolvedValue(null);
    const rec: FirstPracticeRecommendation = {
      type: 'topic',
      lang: 'mn',
      topicId: 'travel',
      title: 'x',
      reason: 'y',
    };
    expect(await buildRecommendedSet(rec)).toBeNull();
  });

  it('returns null when the bank cannot be loaded', async () => {
    vi.mocked(loadWordBank).mockResolvedValue(null);
    const rec: FirstPracticeRecommendation = {
      type: 'cefr',
      lang: 'mn',
      level: 'B2',
      title: 'x',
      reason: 'y',
    };
    expect(await buildRecommendedSet(rec)).toBeNull();
  });

  it('returns null for seed recommendations (handled by the starter-seed path)', async () => {
    const rec: FirstPracticeRecommendation = {
      type: 'seed',
      lang: 'mn',
      title: 'Mongolian Basics',
      reason: 'Starting with essential basics',
    };
    expect(await buildRecommendedSet(rec)).toBeNull();
  });
});
