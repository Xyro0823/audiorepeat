import { describe, expect, it } from 'vitest';
import {
  filterConceptRows,
  filterVariants,
  languageSummary,
  topicConceptRows,
} from '@/lib/adminDiagnostics';
import { analyze, loadRepo, type VocabRepo, type WordBank, type WordPair } from '@/lib/vocabHealth';

/** Synthetic repo with MATCH / VARIANT / TOPIC-ONLY coverage for one lang. */
function fixtureRepo(): VocabRepo {
  const banks: Record<string, WordBank> = {};
  const vocabManifest: Record<string, Record<string, number>> = {};
  for (const lvl of ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']) {
    const words: WordPair[] =
      lvl === 'A1'
        ? [['tempA1', 'temperature'], ['pain1', 'pain']]
        : lvl === 'A2'
          ? [['tempA2', 'temperature']]
          : lvl === 'B1'
            ? [['alt', 'temperature']]
            : [];
    banks[`xx-${lvl}`] = { lang: 'xx', level: lvl, words };
    vocabManifest.xx = { ...(vocabManifest.xx ?? {}), [lvl]: words.length };
  }
  const topics = {
    med: {
      xx: [
        ['tempA1', 'temperature'], // MATCH
        ['зонтик', 'umbrella'], // TOPIC-ONLY
        ['бол', 'pain'], // VARIANT
      ] as WordPair[],
    },
  };
  const topicManifest = { med: { label: 'Med', emoji: '💊', langs: { xx: 3 } } };
  return { vocabManifest, banks, topicManifest, topics, packCodes: ['xx'] };
}

const fixtureReport = () => analyze(fixtureRepo());

describe('adminDiagnostics — language summary', () => {
  it('aggregates pack levels, totals and MATCH/VARIANT/TOPIC-ONLY counts', () => {
    const s = languageSummary(fixtureReport(), 'xx');
    expect(s).not.toBeNull();
    expect(s!.levels).toEqual([
      ['A1', 2],
      ['A2', 1],
      ['B1', 1],
      ['B2', 0],
      ['C1', 0],
      ['C2', 0],
    ]);
    expect(s!.totalWords).toBe(4);
    expect(s!.topicsCovered).toBe(1);
    expect(s!.totalTopicPairs).toBe(3);
    expect(s!.matches).toBe(1);
    expect(s!.variants).toBe(1);
    expect(s!.topicOnly).toBe(1);
    // Covered = matches + variants.
    expect(s!.matches + s!.variants).toBe(2);
  });

  it('returns null for an unknown language', () => {
    expect(languageSummary(fixtureReport(), 'zz')).toBeNull();
  });
});

describe('adminDiagnostics — topic+language table', () => {
  it('builds rows aligned index-for-index with the canonical English core', () => {
    const rows = topicConceptRows(fixtureReport(), 'med', 'xx');
    expect(rows).not.toBeNull();
    expect(rows!.map((r) => r.index)).toEqual([1, 2, 3]);
    expect(rows!.map((r) => r.english)).toEqual(['temperature', 'umbrella', 'pain']);
    expect(rows!.map((r) => r.status)).toEqual(['MATCH', 'TOPIC-ONLY', 'VARIANT']);
    // MATCH row carries bank levels + targets.
    expect(rows![0].levels).toContain('A1');
    expect(rows![0].bankTargets).toContain('tempA1');
  });

  it('returns null for an unknown topic or language', () => {
    const report = fixtureReport();
    expect(topicConceptRows(report, 'nope', 'xx')).toBeNull();
    expect(topicConceptRows(report, 'med', 'zz')).toBeNull();
  });

  it('filters rows by status and by English/target search', () => {
    const report = fixtureReport();
    const rows = topicConceptRows(report, 'med', 'xx')!;
    expect(filterConceptRows(rows, 'MATCH', '').map((r) => r.english)).toEqual(['temperature']);
    expect(filterConceptRows(rows, 'TOPIC-ONLY', '').map((r) => r.english)).toEqual(['umbrella']);
    expect(filterConceptRows(rows, 'VARIANT', '').map((r) => r.english)).toEqual(['pain']);
    expect(filterConceptRows(rows, 'all', '').map((r) => r.english)).toEqual([
      'temperature',
      'umbrella',
      'pain',
    ]);
    // Search by target word.
    expect(filterConceptRows(rows, 'all', 'бол').map((r) => r.english)).toEqual(['pain']);
    // Search by English concept.
    expect(filterConceptRows(rows, 'all', 'UMBRELLA').map((r) => r.english)).toEqual(['umbrella']);
  });
});

describe('adminDiagnostics — variant review', () => {
  it('filters the flat VARIANT list by language, topic and search', () => {
    const report = fixtureReport();
    expect(filterVariants(report).map((r) => r.english)).toEqual(['pain']);
    expect(filterVariants(report, { lang: 'zz' })).toEqual([]);
    expect(filterVariants(report, { topic: 'med' }).map((r) => r.english)).toEqual(['pain']);
    expect(filterVariants(report, { topic: 'nope' })).toEqual([]);
    // Search matches topic target or bank target.
    expect(filterVariants(report, { search: 'бол' }).map((r) => r.english)).toEqual(['pain']);
    expect(filterVariants(report, { search: 'pain1' }).map((r) => r.english)).toEqual(['pain']);
    expect(filterVariants(report, { search: 'zzz' })).toEqual([]);
    // limit works.
    expect(filterVariants(report, { limit: 0 })).toEqual([]);
  });
});

describe('adminDiagnostics — real repository data', () => {
  const report = analyze(loadRepo());

  it('health/mn temperature is MATCH at A2 with the fixed target', () => {
    const rows = topicConceptRows(report, 'health', 'mn')!;
    const temp = rows.find((r) => r.english === 'temperature');
    expect(temp).toBeDefined();
    expect(temp!.status).toBe('MATCH');
    expect(temp!.levels).toContain('A2');
    expect(temp!.target).toBe('температур');
    // All rows align with the core length.
    expect(rows).toHaveLength(report.topicDetails.find((t) => t.id === 'health')!.coreSize);
  });

  it('mn summary shows full topic coverage and totals that match the manifest', () => {
    const s = languageSummary(report, 'mn');
    expect(s!.topicsCovered).toBe(19);
    expect(s!.totalTopicPairs).toBe(773);
    expect(s!.matches + s!.variants + s!.topicOnly).toBe(773);
    // Known real-data worst overlap for mn (B2-C1, from the cross-level audit).
    expect(s!.worstTargetPair).toBe('B2-C1');
    expect(s!.worstTargetOverlap).toBe(42.2);
  });

  it('works for every pack language and topic', () => {
    for (const lang of Object.keys(report.perLanguage)) {
      const s = languageSummary(report, lang);
      expect(s, `${lang}: summary`).not.toBeNull();
      expect(s!.topicsCovered).toBe(19);
      for (const t of report.topicDetails) {
        const rows = topicConceptRows(report, t.id, lang);
        expect(rows, `${lang}/${t.id}: rows`).not.toBeNull();
        expect(rows!.length).toBe(t.coreSize);
      }
    }
  });
});
