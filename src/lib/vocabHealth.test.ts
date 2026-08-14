import { describe, expect, it } from 'vitest';
import { analyze, loadRepo, renderSummary } from '../../scripts/vocab-health.mjs';

type Word = [string, string];
type Bank = { lang: string; level: string; words: Word[] };
type Repo = {
  vocabManifest: Record<string, Record<string, number>>;
  banks: Record<string, Bank>;
  topicManifest: Record<string, { label: string; emoji: string; langs: Record<string, number> }>;
  topics: Record<string, Record<string, Word[]>>;
  packCodes: string[];
};

type TopicLangSummary = Record<string, { topicsCovered: number; totalPairs: number }>;
type CoverageRow = {
  english: string;
  target: string;
  levels: string[];
  status: 'MATCH' | 'VARIANT' | 'TOPIC-ONLY';
  bankTargets: string[];
};
type CoverageSummary = Record<string, { covered: number; matches: number; variants: number; topicOnly: number }>;
type TopicDetail = {
  id: string;
  coreSize: number;
  core: string[];
  targets: Record<string, string[]>;
  bankCoverage: Record<string, CoverageRow[]>;
  coverageSummary: CoverageSummary;
};

/** Fixture with deliberate MATCH / VARIANT / TOPIC-ONLY bank coverage. */
function coverageRepo(): Repo {
  const banks: Record<string, Bank> = {
    'xx-A1': { lang: 'xx', level: 'A1', words: [['tempA1', 'temperature'], ['pain1', 'pain']] },
    'xx-A2': { lang: 'xx', level: 'A2', words: [['tempA2', 'temperature']] },
    'xx-B1': { lang: 'xx', level: 'B1', words: [['alt', 'temperature']] },
    'xx-B2': { lang: 'xx', level: 'B2', words: [] },
    'xx-C1': { lang: 'xx', level: 'C1', words: [] },
    'xx-C2': { lang: 'xx', level: 'C2', words: [] },
  };
  const vocabManifest: Record<string, Record<string, number>> = {
    xx: { A1: 2, A2: 1, B1: 1, B2: 0, C1: 0, C2: 0 },
  };
  const topics = {
    med: {
      xx: [
        ['tempA1', 'temperature'], // MATCH at A1, A2, B1
        ['зонтик', 'umbrella'], // TOPIC-ONLY
        ['бол', 'pain'], // VARIANT (bank target is pain1)
      ] as Word[],
    },
  };
  const topicManifest = {
    med: { label: 'Med', emoji: '💊', langs: { xx: 3 } },
  };
  return { vocabManifest, banks, topicManifest, topics, packCodes: ['xx'] };
}

/** Minimal healthy synthetic repo for one pack language. */
function healthyRepo(): Repo {
  const banks: Record<string, Bank> = {};
  const vocabManifest: Record<string, Record<string, number>> = {};
  // Words are unique across ALL levels (level embedded in both target and
  // english) so the synthetic fixture produces zero cross-level overlap.
  const words = (lvl: string, n: number): Word[] =>
    Array.from({ length: n }, (_, i) => [`t${lvl}-${i}`, `english ${lvl} ${i}`]);
  for (const lvl of ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']) {
    banks[`xx-${lvl}`] = { lang: 'xx', level: lvl, words: words(lvl, 10) };
    vocabManifest.xx = { ...(vocabManifest.xx ?? {}), [lvl]: 10 };
  }
  const topics = {
    home: { xx: [['xy', 'house'], ['xz', 'table']] as Word[] },
  };
  const topicManifest = {
    home: { label: 'Home', emoji: '🏠', langs: { xx: 2 } },
  };
  return { vocabManifest, banks, topicManifest, topics, packCodes: ['xx'] };
}

/** Synthetic repo where a configured hard terminology error is violated. */
function brokenTerminologyRepo(): Repo {
  const banks: Record<string, Bank> = {};
  const vocabManifest: Record<string, Record<string, number>> = {};
  for (const lvl of ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']) {
    // mn-A1 carries the wrong target for the guarded concept `temperature`.
    const words: Word[] =
      lvl === 'A1' ? [['буруу', 'temperature']] : [[`t${lvl}`, `english ${lvl}`]];
    banks[`mn-${lvl}`] = { lang: 'mn', level: lvl, words };
    vocabManifest.mn = { ...(vocabManifest.mn ?? {}), [lvl]: words.length };
  }
  const topics = { med: { mn: [['буруу', 'temperature']] as Word[] } };
  const topicManifest = {
    med: { label: 'Med', emoji: '💊', langs: { mn: 1 } },
  };
  return { vocabManifest, banks, topicManifest, topics, packCodes: ['mn'] };
}

describe('vocab-health report analysis', () => {
  it('healthy synthetic repo passes with no failures', () => {
    const report = analyze(healthyRepo());
    expect(report.status).toBe('ok');
    expect(report.failures).toEqual([]);
    expect(report.counts.packLanguages).toBe(1);
    expect(report.counts.bankFiles).toBe(6);
  });

  it('missing level is a hard failure', () => {
    const repo = healthyRepo();
    delete repo.banks['xx-C2'];
    delete repo.vocabManifest.xx.C2;
    const report = analyze(repo);
    expect(report.status).toBe('fail');
    expect(report.failures.some((f: string) => f.includes('missing levels'))).toBe(true);
  });

  it('manifest count mismatch is a hard failure', () => {
    const repo = healthyRepo();
    repo.vocabManifest.xx.A1 = 999;
    const report = analyze(repo);
    expect(report.status).toBe('fail');
    expect(report.failures.some((f: string) => f.includes('manifest count'))).toBe(true);
  });

  it('duplicate pair is a hard failure', () => {
    const repo = healthyRepo();
    // Push an exact copy of an existing A1 pair (and keep the manifest count
    // in sync so the duplicate check is the only thing that fires).
    repo.banks['xx-A1'].words.push(['tA1-0', 'english A1 0']);
    repo.vocabManifest.xx.A1 = repo.banks['xx-A1'].words.length;
    const report = analyze(repo);
    expect(report.status).toBe('fail');
    expect(report.failures.some((f: string) => f.includes('duplicate pair'))).toBe(true);
  });

  it('cross-level target-overlap threshold violation fails', () => {
    // B1 and B2 share every target (copy) -> target overlap ~100% > 50%.
    const repo = healthyRepo();
    repo.banks['xx-B2'] = { lang: 'xx', level: 'B2', words: repo.banks['xx-B1'].words };
    repo.vocabManifest.xx.B2 = repo.banks['xx-B1'].words.length;
    const report = analyze(repo);
    expect(report.status).toBe('fail');
    expect(report.failures.some((f: string) => f.includes('target overlap'))).toBe(true);
  });

  it('hard terminology violation is reported', () => {
    const repo = healthyRepo();
    // mn bank 'temperature' must equal 'температур'; break it.
    repo.banks['mn-A1'] = { lang: 'mn', level: 'A1', words: [['халуун', 'temperature']] };
    repo.banks['mn-A2'] = { lang: 'mn', level: 'A2', words: [['z2', 'zz2']] };
    repo.banks['mn-B1'] = { lang: 'mn', level: 'B1', words: [['z3', 'zz3']] };
    repo.banks['mn-B2'] = { lang: 'mn', level: 'B2', words: [['z4', 'zz4']] };
    repo.banks['mn-C1'] = { lang: 'mn', level: 'C1', words: [['z5', 'zz5']] };
    repo.banks['mn-C2'] = { lang: 'mn', level: 'C2', words: [['z6', 'zz6']] };
    repo.vocabManifest.mn = { A1: 1, A2: 1, B1: 1, B2: 1, C1: 1, C2: 1 };
    repo.packCodes = ['xx', 'mn'];
    const report = analyze(repo);
    expect(report.terminology.violations.length).toBeGreaterThan(0);
    expect(report.status).toBe('fail');
  });

  it('topic manifest/file count mismatch is a hard failure', () => {
    const repo = healthyRepo();
    // Extra concept in the file while the manifest still advertises 2.
    repo.topics.home.xx = [['xy', 'house'], ['xz', 'table'], ['xq', 'extra']];
    const report = analyze(repo);
    expect(report.status).toBe('fail');
    expect(
      report.failures.some((f: string) => f.includes('topic manifest') || f.includes('topic core')),
    ).toBe(true);
  });

  it('topic detail and per-language summary are produced', () => {
    const report = analyze(healthyRepo());
    expect(report.topicDetails).toHaveLength(1);
    expect(report.topicDetails[0]).toMatchObject({
      id: 'home',
      languages: 1,
      totalPairs: 2,
      coreSize: 2,
      parityStatus: 'OK',
    });
    expect(report.topicDetails[0].counts).toEqual({ xx: 2 });
    expect((report.topicLanguageSummary as TopicLangSummary).xx).toEqual({
      topicsCovered: 1,
      totalPairs: 2,
    });
  });

  it('topic detail includes the ordered canonical English core', () => {
    const report = analyze(healthyRepo());
    const home = report.topicDetails[0];
    expect(home.core).toEqual(['house', 'table']);
    // Core length must equal coreSize (parity reference length).
    expect(home.core).toHaveLength(home.coreSize);
    expect(home.coreSize).toBe(2);
  });

  it('topic details expose ordered targets aligned index-for-index with core', () => {
    const repo = healthyRepo();
    const report = analyze(repo);
    const home = report.topicDetails[0];
    const core = home.core as string[];
    const targets = home.targets as Record<string, string[]>;
    expect(targets).toEqual({ xx: ['xy', 'xz'] });
    expect(targets.xx).toHaveLength(core.length);
    for (let i = 0; i < core.length; i++) {
      // [targets[lang][i], core[i]] equals the raw source pair at index i.
      expect([targets.xx[i], core[i]]).toEqual(repo.topics.home.xx[i]);
    }
  });

  it('renderSummary --topic --lang renders English + target table in order', () => {
    const report = analyze(healthyRepo());
    const text = renderSummary(report, { topic: 'home', lang: 'xx' });
    expect(text).toContain('house');
    expect(text).toContain('xy');
    expect(text).toContain('table');
    expect(text).toContain('xz');
    // Ordering preserved (English core and target column).
    expect(text.indexOf('house')).toBeLessThan(text.indexOf('table'));
    expect(text.indexOf('xy')).toBeLessThan(text.indexOf('xz'));
    // The table subsumes the plain core list, so no duplicate dump.
    expect(text).not.toContain('Core concepts');
  });

  it('unknown language in --topic mode is handled safely', () => {
    const report = analyze(healthyRepo());
    const text = renderSummary(report, { topic: 'home', lang: 'yy' });
    expect(text).toContain('not present in topic home');
    // Core list still available for review; no bogus target table.
    expect(text).toContain('Core concepts');
    expect(text).not.toContain('(unknown topic');
  });

  it('default report does not dump translation tables', () => {
    const report = analyze(healthyRepo());
    const full = renderSummary(report);
    expect(full).not.toContain('Target');
    expect(full).not.toContain('Core concepts');
  });

  it('bank coverage classifies MATCH / VARIANT / TOPIC-ONLY with canonical levels', () => {
    const report = analyze(coverageRepo());
    expect(report.status).toBe('ok'); // diagnostic only — never a hard gate.
    const med = report.topicDetails[0] as unknown as TopicDetail;
    const rows = med.bankCoverage.xx;
    expect(rows[0]).toMatchObject({
      english: 'temperature',
      target: 'tempA1',
      levels: ['A1', 'A2', 'B1'], // canonical order preserved
      status: 'MATCH',
      bankTargets: ['tempA1', 'tempA2', 'alt'],
    });
    expect(rows[1]).toMatchObject({ english: 'umbrella', levels: [], status: 'TOPIC-ONLY' });
    expect(rows[2]).toMatchObject({
      english: 'pain',
      target: 'бол',
      levels: ['A1'],
      status: 'VARIANT',
      bankTargets: ['pain1'],
    });
  });

  it('bank coverage aligns index-for-index with core', () => {
    const report = analyze(coverageRepo());
    const med = report.topicDetails[0] as unknown as TopicDetail;
    const rows = med.bankCoverage.xx;
    const core = med.core;
    const targets = med.targets.xx;
    expect(rows).toHaveLength(core.length);
    rows.forEach((r, i) => {
      expect(r.english).toBe(core[i]);
      expect(r.target).toBe(targets[i]);
    });
  });

  it('coverage summary is produced per language', () => {
    const report = analyze(coverageRepo());
    const med = report.topicDetails[0] as unknown as TopicDetail;
    expect(med.coverageSummary.xx).toEqual({
      covered: 2,
      matches: 1,
      variants: 1,
      topicOnly: 1,
    });
  });

  it('renderSummary --topic --lang shows Bank/Status columns and summary', () => {
    const report = analyze(coverageRepo());
    const text = renderSummary(report, { topic: 'med', lang: 'xx' });
    expect(text).toContain('Bank');
    expect(text).toContain('Status');
    expect(text).toContain('MATCH');
    expect(text).toContain('TOPIC-ONLY');
    expect(text).toContain('VARIANT');
    expect(text).toContain('Topic concepts covered by CEFR banks:');
    expect(text).toContain('covered: 2 (67%)');
  });

  it('default report stays concise without bank columns', () => {
    const report = analyze(coverageRepo());
    const full = renderSummary(report);
    expect(full).not.toContain('MATCH');
    expect(full).not.toContain('TOPIC-ONLY');
  });

  it('real data: health/mn temperature is A2 + MATCH', () => {
    const report = analyze(loadRepo());
    const health = report.topicDetails.find((t) => t.id === 'health')! as unknown as TopicDetail;
    const core = health.core;
    const rows = health.bankCoverage.mn;
    const i = core.indexOf('temperature');
    expect(rows[i].levels).toContain('A2');
    expect(rows[i].status).toBe('MATCH');
  });

  it('real data: confirmed terminology fixes hold (mn disappointed, ar calm)', () => {
    const report = analyze(loadRepo());
    expect(report.status).toBe('ok');
    expect(report.terminology.violations).toEqual([]);
    // mn emotions topic: disappointed = урам хугарсан (fixed typo).
    const emotions = report.topicDetails.find((t) => t.id === 'emotions')!;
    const core = emotions.core as string[];
    const mnTargets = (emotions.targets as Record<string, string[]>).mn;
    expect(mnTargets[core.indexOf('disappointed')]).toBe('урам хугарсан');
    // ar bank B1: calm = هادئ (fixed mistranslation).
    const arB1 = (loadRepo().banks as Record<string, Bank>)['ar-B1'];
    const calm = arB1.words.find((w: Word) => w[1] === 'calm');
    expect(calm?.[0]).toBe('هادئ');
  });

  it('real data: targets align with core for every topic/language', () => {
    const report = analyze(loadRepo());
    expect(report.status).toBe('ok');
    for (const t of report.topicDetails) {
      const core = t.core as string[];
      const targets = t.targets as Record<string, string[]>;
      for (const arr of Object.values(targets)) {
        expect(arr).toHaveLength(core.length);
      }
    }
    // health/mn temperature must still resolve to температур.
    const health = report.topicDetails.find((x) => x.id === 'health')!;
    const core = health.core as string[];
    const targets = health.targets as Record<string, string[]>;
    expect(targets.mn[core.indexOf('temperature')]).toBe('температур');
  });

  it('renderSummary --topic shows the ordered core, default report does not', () => {
    const report = analyze(healthyRepo());
    const topicText = renderSummary(report, { topic: 'home' });
    expect(topicText).toContain('Core concepts (2):');
    // Ordering preserved exactly as in the data.
    expect(topicText.indexOf('1. house')).toBeGreaterThan(-1);
    expect(topicText.indexOf('2. table')).toBeGreaterThan(topicText.indexOf('1. house'));
    // The full (unfiltered) report stays concise — no core dump.
    const fullText = renderSummary(report);
    expect(fullText).not.toContain('Core concepts');
  });

  it('renderSummary with unknown topic is safe', () => {
    const report = analyze(healthyRepo());
    const text = renderSummary(report, { topic: 'nope' });
    expect(text).toContain('(unknown topic: nope)');
  });

  it('topic coverage summary is produced on healthy data', () => {
    const report = analyze(healthyRepo());
    expect(report.topicCoverage).toEqual({
      totalLanguages: 1,
      languagesInAllTopics: ['xx'],
      packMissingFromAnyTopic: [],
      topicOnlyLanguages: [],
      topicsWithDifferentLanguageSet: [],
    });
  });

  it('missing topic language is reported in topic detail', () => {
    const repo = healthyRepo();
    // File drops the manifest language (xx) and adds an unexpected one.
    repo.topics.home = { yy: [['a', 'alpha'], ['b', 'beta']] };
    const report = analyze(repo);
    const home = report.topicDetails[0];
    expect(home.parityStatus).toBe('FAIL');
    expect(home.issues.some((i: string) => i.includes('missing language: xx'))).toBe(true);
    expect(home.issues.some((i: string) => i.includes('extra language: yy'))).toBe(true);
    expect(report.status).toBe('fail');
  });

  it('topic concept-count mismatch is reported in topic detail', () => {
    const repo = healthyRepo();
    // Add a second language so the reference core is defined independently;
    // then break yy by adding a concept the core does not have.
    repo.topicManifest.home.langs = { xx: 2, yy: 2 };
    repo.topics.home.yy = [['ya', 'alpha'], ['yb', 'beta'], ['yc', 'extra']];
    const report = analyze(repo);
    const home = report.topicDetails[0];
    expect(home.parityStatus).toBe('FAIL');
    expect(home.issues.some((i: string) => i.includes('concept count mismatch: yy'))).toBe(true);
    expect(report.status).toBe('fail');
  });

  it('JSON shape adds topic fields and preserves existing ones', () => {
    const report = analyze(healthyRepo());
    expect(report.status).toBe('ok');
    for (const key of ['status', 'counts', 'perLanguage', 'topicStats', 'crossLevel', 'isolation', 'terminology', 'b1Overlap']) {
      expect(key in report).toBe(true);
    }
    expect(Array.isArray(report.topicDetails)).toBe(true);
    // Backward-compatible JSON: existing fields preserved, core is additive.
    expect(report.topicDetails[0]).toHaveProperty('core');
    expect(report.topicDetails[0].core).toEqual(['house', 'table']);
    // targets is additive and aligned with core.
    expect(report.topicDetails[0]).toHaveProperty('targets');
    const tTargets = report.topicDetails[0].targets as Record<string, string[]>;
    expect(tTargets.xx).toEqual(['xy', 'xz']);
    expect(tTargets.xx).toHaveLength(report.topicDetails[0].core.length);
    expect(typeof report.topicLanguageSummary).toBe('object');
    expect(typeof report.topicCoverage).toBe('object');
    expect(report.counts.topics).toBe(1);
  });

  it('renderSummary supports --topic and --lang filters', () => {
    const report = analyze(healthyRepo());
    const topicText = renderSummary(report, { topic: 'home' });
    expect(topicText).toContain('Topic home per-language:');
    expect(topicText).toContain('xx');
    const langText = renderSummary(report, { lang: 'xx' });
    expect(langText).toContain('Language: xx');
    expect(langText).toContain('topics covered: 1/1');
    expect(langText).toContain('bank levels:');
  });

  // ---- Human-review filters (--only-variants / --errors-only) -------------

  it('--only-variants lists exactly the VARIANT rows', () => {
    const report = analyze(coverageRepo());
    // Fixture has exactly one VARIANT: pain (topic бол vs bank pain1).
    expect(report.variantRows).toHaveLength(1);
    expect(report.variantRows[0]).toMatchObject({
      lang: 'xx',
      topic: 'med',
      english: 'pain',
      topicTarget: 'бол',
      bankTargets: ['pain1'],
      status: 'VARIANT',
    });
    const text = renderSummary(report, { onlyVariants: true });
    expect(text).toContain('VARIANT rows (human review only):');
    expect(text).toContain('xx | med | pain | бол | pain1');
    // MATCH/TOPIC-ONLY rows must not appear in the variant list.
    expect(text).not.toContain('temperature');
    expect(text).not.toContain('umbrella');
  });

  it('--only-variants --lang filters to one language', () => {
    const report = analyze(coverageRepo());
    const text = renderSummary(report, { onlyVariants: true, lang: 'xx' });
    expect(text).toContain('xx | med | pain');
    const none = renderSummary(report, { onlyVariants: true, lang: 'zz' });
    expect(none).toContain('none');
  });

  it('--only-variants --topic filters to one topic', () => {
    const report = analyze(coverageRepo());
    const text = renderSummary(report, { onlyVariants: true, topic: 'med' });
    expect(text).toContain('xx | med | pain');
    const none = renderSummary(report, { onlyVariants: true, topic: 'nope' });
    expect(none).toContain('none');
  });

  it('--only-variants --topic --lang combines both filters', () => {
    const report = analyze(coverageRepo());
    const text = renderSummary(report, { onlyVariants: true, topic: 'med', lang: 'xx' });
    expect(text).toContain('xx | med | pain');
    const none = renderSummary(report, { onlyVariants: true, topic: 'med', lang: 'zz' });
    expect(none).toContain('none');
  });

  it('--errors-only shows none on healthy data', () => {
    const report = analyze(healthyRepo());
    expect(report.hardErrorRows).toEqual([]);
    const text = renderSummary(report, { errorsOnly: true });
    expect(text).toContain('Hard terminology errors:');
    expect(text).toContain('  none');
  });

  it('--errors-only surfaces synthetic hard terminology errors', () => {
    const report = analyze(brokenTerminologyRepo());
    expect(report.terminology.violations.length).toBeGreaterThan(0);
    const text = renderSummary(report, { errorsOnly: true });
    expect(text).toContain('Hard terminology errors:');
    expect(text).toContain('temperature');
    expect(text).toContain('температур');
    // A hard failure must also flip overall status to fail.
    expect(report.status).toBe('fail');
  });

  it('--only-variants and --errors-only together are rejected', () => {
    const report = analyze(healthyRepo());
    expect(() => renderSummary(report, { onlyVariants: true, errorsOnly: true })).toThrow(
      '--only-variants and --errors-only cannot be combined',
    );
  });

  it('default report does not include the VARIANT rows section', () => {
    const report = analyze(coverageRepo());
    const text = renderSummary(report);
    expect(text).not.toContain('VARIANT rows (human review only):');
    expect(text).not.toContain('lang | topic | english');
  });

  it('JSON is backward-compatible with variantRows and hardErrorRows', () => {
    const report = analyze(healthyRepo());
    expect(Array.isArray(report.variantRows)).toBe(true);
    expect(Array.isArray(report.hardErrorRows)).toBe(true);
    expect(report.variantRows).toHaveLength(0);
    expect(report.hardErrorRows).toHaveLength(0);
    // Top-level fields from before the filter feature remain intact.
    for (const key of ['status', 'counts', 'perLanguage', 'topicStats', 'topicDetails', 'topicLanguageSummary', 'topicCoverage', 'crossLevel', 'isolation', 'terminology', 'b1Overlap', 'warnings', 'failures']) {
      expect(key in report).toBe(true);
    }
  });
});
