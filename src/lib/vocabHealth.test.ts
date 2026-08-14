import { describe, expect, it } from 'vitest';
import { analyze } from '../../scripts/vocab-health.mjs';

type Word = [string, string];
type Bank = { lang: string; level: string; words: Word[] };
type Repo = {
  vocabManifest: Record<string, Record<string, number>>;
  banks: Record<string, Bank>;
  topicManifest: Record<string, { label: string; emoji: string; langs: Record<string, number> }>;
  topics: Record<string, Record<string, Word[]>>;
  packCodes: string[];
};

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
});
