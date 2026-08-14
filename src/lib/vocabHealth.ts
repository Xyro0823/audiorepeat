/**
 * Shared Evoq vocabulary/language health analysis.
 *
 * Single source of truth for the vocabulary/topic integrity checks: the
 * developer CLI (`scripts/vocab-health.mjs`), the CI-gated audit
 * (`src/lib/languageAudit.test.ts` via shared thresholds) and the admin
 * diagnostics API (`/api/admin/diagnostics/languages`) all read from here so
 * the report can never drift between surfaces.
 *
 * `analyze()` is pure (operates on in-memory data) and testable; `loadRepo()`
 * reads the static JSON under `public/data/` from disk (Node-only — used by
 * the CLI and the server API route, never by client code).
 */
import fs from 'node:fs';
import path from 'node:path';
// Explicit .ts extensions: this module is consumed both by plain Node (the
// developer CLI) and by the Next.js server — Node's ESM resolver requires the
// extension, and tsconfig enables allowImportingTsExtensions for tsc.
import { CEFR_LEVELS } from '../types/app.ts';
import {
  B1_OVERLAP_MAX,
  CROSS_LEVEL_PAIR_MAX,
  CROSS_LEVEL_TARGET_MAX,
  LANGUAGE_ISOLATION_MAX,
  norm,
  overlapRatio,
  pairSet,
  targetSet,
} from './vocabThresholds.ts';

/** Compact [target, translation] pair. */
export type WordPair = [target: string, translation: string];

/** A single <lang>-<level> vocabulary bank file on disk. */
export interface WordBank {
  lang: string;
  level: string;
  words: WordPair[];
}

/** topicManifest entry: labels/emojis + per-language advertised counts. */
export interface TopicManifestEntry {
  label: string;
  emoji: string;
  langs: Record<string, number>;
}

/** The in-memory data `analyze()` consumes (mirrors the CLI loader). */
export interface VocabRepo {
  vocabManifest?: Record<string, Record<string, number>>;
  banks: Record<string, WordBank>;
  topicManifest?: Record<string, TopicManifestEntry>;
  topics: Record<string, Record<string, WordPair[]>>;
  packCodes?: string[];
  levels?: readonly string[];
}

// Hard terminology errors known to be fixed in the data. Keyed by pack
// language -> english concept -> expected translation in both bank and topic.
// Mirrors the CI-gated guard in src/lib/languageAudit.test.ts.
export const HARD_TERMINOLOGY_ERRORS: Record<string, Record<string, string>> = {
  mn: { temperature: 'температур', disappointed: 'урам хугарсан' },
  ar: { calm: 'هادئ' },
};

// Canonical pack-language codes (2-letter, as used in bank/topic filenames).
// These mirror src/lib/starterSets.ts (PACK_LANG values). The audit still
// derives its language set from STARTER_LANGS; this list is only the static
// identifier set the report needs without resolving the '@/' alias.
export const PACK_CODES = ['ar', 'de', 'es', 'fr', 'hi', 'it', 'ja', 'ko', 'mn', 'pt', 'ru', 'tr', 'zh'];

/* ------------------------------------------------------------------------ */
/* Report types                                                              */
/* ------------------------------------------------------------------------ */

export interface PerLanguageEntry {
  lang: string;
  levels: Record<string, number>;
  missing: string[];
  unexpected: string[];
}

export interface CrossLevelEntry {
  worstTargetOverlap: number;
  worstTargetPair: string;
  worstPairOverlap: number;
  worstPairPair: string;
}

export interface TermErrorRow {
  pack: string;
  source: string;
  english: string;
  target: string;
  expected: string;
}

export interface CoverageRow {
  english: string;
  target: string;
  levels: string[];
  status: 'MATCH' | 'VARIANT' | 'TOPIC-ONLY';
  bankTargets: string[];
}

export interface CoverageSummary {
  covered: number;
  matches: number;
  variants: number;
  topicOnly: number;
}

export interface TopicDetail {
  id: string;
  languages: number;
  counts: Record<string, number>;
  totalPairs: number;
  coreSize: number;
  core: string[];
  targets: Record<string, string[]>;
  bankCoverage: Record<string, CoverageRow[]>;
  coverageSummary: Record<string, CoverageSummary>;
  parityStatus: 'OK' | 'FAIL';
  issues: string[];
}

export interface TopicLanguageSummaryEntry {
  topicsCovered: number;
  totalPairs: number;
}

export interface VariantRow {
  lang: string;
  topic: string;
  english: string;
  topicTarget: string;
  bankTargets: string[];
  levels: string[];
  status: 'VARIANT';
}

export interface TopicCoverage {
  totalLanguages: number;
  languagesInAllTopics: string[];
  packMissingFromAnyTopic: string[];
  topicOnlyLanguages: string[];
  topicsWithDifferentLanguageSet: string[];
}

export interface HealthReport {
  status: 'ok' | 'fail';
  counts: {
    packLanguages: number;
    bankFiles: number;
    totalVocabPairs: number;
    topics: number;
    topicLanguages: number;
    totalTopicPairs: number;
  };
  perLanguage: Record<string, PerLanguageEntry>;
  topicStats: {
    topics: number;
    topicLanguages: number;
    totalTopicPairs: number;
    coreMismatches: string[];
    packCoverageMissing: string[];
    manifestCountMismatch: string[];
    fileLanguageMismatch: string[];
  };
  topicDetails: TopicDetail[];
  topicLanguageSummary: Record<string, TopicLanguageSummaryEntry>;
  topicCoverage: TopicCoverage;
  crossLevel: Record<string, CrossLevelEntry>;
  isolation: { worstOverlap: number; langPair: string; level: string };
  terminology: { configured: number; violations: string[]; errorRows: TermErrorRow[] };
  b1Overlap: Record<string, number>;
  variantRows: VariantRow[];
  hardErrorRows: TermErrorRow[];
  warnings: string[];
  failures: string[];
}

/* ------------------------------------------------------------------------ */
/* Analysis                                                                  */
/* ------------------------------------------------------------------------ */

/** Compute the health report from in-memory data. Pure and testable. */
export function analyze(repo: VocabRepo): HealthReport {
  const { banks, topics } = repo;
  const vocabManifest = repo.vocabManifest ?? {};
  const topicManifest = repo.topicManifest ?? {};
  const packCodes = repo.packCodes ?? PACK_CODES;
  const levels = repo.levels ?? CEFR_LEVELS;

  const failures: string[] = [];
  const warnings: string[] = [];
  // Only analyze packs that actually exist in the manifest — the static list
  // is the identifier set, the manifest is the source of truth for presence.
  const packs = packCodes.filter((c) => vocabManifest[c]);

  // ---- A. Pack coverage -------------------------------------------------
  const perLang: Record<string, PerLanguageEntry> = {};
  let totalPairs = 0;
  for (const lang of packs) {
    const entry: PerLanguageEntry = { lang, levels: {}, missing: [], unexpected: [] };
    for (const lvl of levels) {
      const bank = banks[`${lang}-${lvl}`];
      if (bank) {
        entry.levels[lvl] = bank.words.length;
        totalPairs += bank.words.length;
      } else {
        entry.missing.push(lvl);
      }
    }
    for (const lvl of Object.keys(entry.levels)) {
      if (!levels.includes(lvl)) entry.unexpected.push(lvl);
    }
    if (entry.missing.length) failures.push(`${lang}: missing levels ${entry.missing.join(',')}`);
    if (entry.unexpected.length) failures.push(`${lang}: unexpected levels ${entry.unexpected.join(',')}`);
    perLang[lang] = entry;
  }

  // ---- B/C. Manifest integrity ------------------------------------------
  const advertised = new Set<string>();
  for (const [lang, lv] of Object.entries(vocabManifest)) {
    for (const lvl of Object.keys(lv)) advertised.add(`${lang}-${lvl}`);
  }
  const onDisk = new Set(Object.keys(banks));
  const orphan = [...onDisk].filter((k) => !advertised.has(k));
  const phantom = [...advertised].filter((k) => !onDisk.has(k));
  for (const k of orphan) failures.push(`orphan bank file not in manifest: ${k}`);
  for (const k of phantom) failures.push(`phantom manifest entry (no file): ${k}`);

  // File identity + count parity + duplicate pairs + malformed rows.
  for (const [key, bank] of Object.entries(banks)) {
    const [fLang, fLvl] = key.split('-');
    if (bank.lang !== fLang) failures.push(`${key}: data.lang "${bank.lang}" != filename "${fLang}"`);
    if (bank.level !== fLvl) failures.push(`${key}: data.level "${bank.level}" != filename "${fLvl}"`);
    const advertisedCount = vocabManifest[fLang]?.[fLvl];
    if (advertisedCount !== undefined && advertisedCount !== bank.words.length) {
      failures.push(`${key}: manifest count ${advertisedCount} != words ${bank.words.length}`);
    }
    if (!Array.isArray(bank.words)) {
      failures.push(`${key}: words is not an array`);
      continue;
    }
    const seenPairs = new Set<string>();
    for (const pair of bank.words) {
      if (!Array.isArray(pair) || pair.length !== 2 || typeof pair[0] !== 'string' || typeof pair[1] !== 'string') {
        failures.push(`${key}: malformed pair ${JSON.stringify(pair)}`);
        continue;
      }
      if (!pair[0].trim() || !pair[1].trim()) {
        failures.push(`${key}: empty target or english "${pair[0]}" -> "${pair[1]}"`);
      }
      const pk = `${norm(pair[0])}|${norm(pair[1])}`;
      if (seenPairs.has(pk)) failures.push(`${key}: duplicate pair ${pk}`);
      seenPairs.add(pk);
    }
  }

  // ---- D. Cross-level overlap -------------------------------------------
  const crossLevel: Record<string, CrossLevelEntry> = {};
  for (const lang of packs) {
    const sets: Record<string, { targets: Set<string>; pairs: Set<string>; size: number }> = {};
    for (const lvl of levels) {
      const words = banks[`${lang}-${lvl}`]?.words ?? [];
      sets[lvl] = { targets: targetSet(words), pairs: pairSet(words), size: words.length };
    }
    let worstTarget = 0;
    let worstTargetPair = '';
    let worstPair = 0;
    let worstPairPair = '';
    for (let i = 0; i < levels.length; i++) {
      for (let j = i + 1; j < levels.length; j++) {
        const a = sets[levels[i]];
        const b = sets[levels[j]];
        const minSize = Math.min(a.size, b.size);
        if (minSize === 0) continue;
        const t = overlapRatio(a.targets, b.targets);
        const p = overlapRatio(a.pairs, b.pairs);
        if (t > worstTarget) {
          worstTarget = t;
          worstTargetPair = `${levels[i]}-${levels[j]}`;
        }
        if (p > worstPair) {
          worstPair = p;
          worstPairPair = `${levels[i]}-${levels[j]}`;
        }
        if (t >= CROSS_LEVEL_TARGET_MAX) {
          failures.push(
            `${lang} ${levels[i]}-${levels[j]}: target overlap ${(t * 100).toFixed(1)}% >= ${(CROSS_LEVEL_TARGET_MAX * 100).toFixed(0)}%`,
          );
        }
        if (p >= CROSS_LEVEL_PAIR_MAX) {
          failures.push(
            `${lang} ${levels[i]}-${levels[j]}: pair overlap ${(p * 100).toFixed(1)}% >= ${(CROSS_LEVEL_PAIR_MAX * 100).toFixed(0)}%`,
          );
        }
      }
    }
    crossLevel[lang] = {
      worstTargetOverlap: +(worstTarget * 100).toFixed(1),
      worstTargetPair,
      worstPairOverlap: +(worstPair * 100).toFixed(1),
      worstPairPair,
    };
  }

  // ---- E. Language isolation --------------------------------------------
  const isolation = { worstOverlap: 0, langPair: '', level: '' };
  for (const lvl of levels) {
    const sets = new Map<string, Set<string>>();
    for (const lang of packs) {
      sets.set(lang, targetSet(banks[`${lang}-${lvl}`]?.words ?? []));
    }
    const arr = [...sets.entries()];
    for (let i = 0; i < arr.length; i++) {
      for (let j = i + 1; j < arr.length; j++) {
        const [l1, s1] = arr[i];
        const [l2, s2] = arr[j];
        const r = overlapRatio(s1, s2);
        if (r > isolation.worstOverlap) {
          isolation.worstOverlap = r;
          isolation.langPair = `${l1}-${l2}`;
          isolation.level = lvl;
        }
        if (r >= LANGUAGE_ISOLATION_MAX) {
          failures.push(
            `isolation: ${l1}-${l2} @${lvl} overlap ${(r * 100).toFixed(1)}% >= ${(LANGUAGE_ISOLATION_MAX * 100).toFixed(0)}%`,
          );
        }
      }
    }
  }
  isolation.worstOverlap = +(isolation.worstOverlap * 100).toFixed(1);

  // ---- F. Terminology health ---------------------------------------------
  const terminology: HealthReport['terminology'] = { configured: 0, violations: [], errorRows: [] };
  for (const [pack, entries] of Object.entries(HARD_TERMINOLOGY_ERRORS)) {
    // Skip packs that have no data at all (synthetic fixtures / partial
    // repos) — the check is only meaningful when the pack actually exists.
    const hasPack = levels.some((lvl) => banks[`${pack}-${lvl}`]);
    for (const [en, correct] of Object.entries(entries)) {
      terminology.configured++;
      const bankHits: boolean[] = [];
      for (const lvl of levels) {
        for (const [t, e] of banks[`${pack}-${lvl}`]?.words ?? []) {
          if (norm(e) === en) bankHits.push(norm(t) === norm(correct));
        }
      }
      if (hasPack && (bankHits.length === 0 || !bankHits.every(Boolean))) {
        terminology.violations.push(`${pack}: bank "${en}" != "${correct}"`);
        terminology.errorRows.push({
          pack,
          source: 'bank',
          english: en,
          target: '(missing or mismatched bank target)',
          expected: correct,
        });
      }
      for (const [topic, data] of Object.entries(topics)) {
        for (const [t, e] of data[pack] ?? []) {
          if (norm(e) === en && norm(t) !== norm(correct)) {
            terminology.violations.push(`${pack} ${topic}: "${en}" -> "${t}" (expected "${correct}")`);
            terminology.errorRows.push({ pack, source: `topic:${topic}`, english: en, target: t, expected: correct });
          }
        }
      }
    }
  }
  for (const v of terminology.violations) failures.push(`terminology: ${v}`);

  // ---- G. Topic/core parity ----------------------------------------------
  // Bank English-gloss index per pack language: norm(english) -> { levels,
  // targets }. Levels are appended in canonical order (CEFR_LEVELS) and
  // targets are deduped preserving first-seen order. Used only for the
  // diagnostic per-row bank coverage below — never a correctness gate.
  const bankIndex: Record<string, Map<string, { levels: string[]; targets: string[] }>> = {};
  for (const lang of packs) {
    const idx = new Map<string, { levels: string[]; targets: string[] }>();
    for (const lvl of levels) {
      for (const [t, e] of banks[`${lang}-${lvl}`]?.words ?? []) {
        const key = norm(e);
        let rec = idx.get(key);
        if (!rec) {
          rec = { levels: [], targets: [] };
          idx.set(key, rec);
        }
        if (!rec.levels.includes(lvl)) rec.levels.push(lvl);
        const nt = norm(t);
        if (!rec.targets.some((x) => norm(x) === nt)) rec.targets.push(t);
      }
    }
    bankIndex[lang] = idx;
  }

  const topicStats = {
    topics: Object.keys(topicManifest).length,
    topicLanguages: new Set<string>(),
    totalTopicPairs: 0,
    coreMismatches: [] as string[],
    packCoverageMissing: [] as string[],
    manifestCountMismatch: [] as string[],
    fileLanguageMismatch: [] as string[],
  };
  // Structured per-topic diagnostics (extended Topic Library detail).
  const topicDetails: TopicDetail[] = [];
  const topicLanguageSummary: Record<string, TopicLanguageSummaryEntry> = {};
  const topicLanguageSets: Record<string, Set<string>> = {};
  const addTopicPairs = (lang: string, n: number) => {
    topicLanguageSummary[lang] ??= { topicsCovered: 0, totalPairs: 0 };
    topicLanguageSummary[lang].topicsCovered += 1;
    topicLanguageSummary[lang].totalPairs += n;
  };
  for (const [topic, meta] of Object.entries(topicManifest)) {
    const data = topics[topic];
    const entry: TopicDetail = {
      id: topic,
      languages: 0,
      counts: {},
      totalPairs: 0,
      coreSize: 0,
      core: [],
      targets: {},
      bankCoverage: {},
      coverageSummary: {},
      parityStatus: 'OK',
      issues: [],
    };
    if (!data) {
      entry.parityStatus = 'FAIL';
      entry.issues.push('no file on disk');
      failures.push(`topic ${topic}: no file on disk`);
      topicDetails.push(entry);
      continue;
    }
    const langs = Object.keys(meta.langs ?? {});
    const ref = langs[0];
    const core = ref && data[ref] ? data[ref].map(([, e]) => norm(e)) : [];
    entry.coreSize = core.length;
    // Canonical ordered English concept list (raw strings, not normalized) —
    // used as the parity reference and shown in the admin diagnostics UI.
    entry.core = ref && data[ref] ? data[ref].map(([, e]) => e) : [];
    // Raw target translations per language actually present in the file,
    // aligned index-for-index with entry.core (both derive from the same
    // ordered [target, english] pair arrays).
    entry.targets = {};
    entry.bankCoverage = {};
    entry.coverageSummary = {};
    for (const [l, list] of Object.entries(data)) {
      entry.targets[l] = list.map(([t]) => t);
      // Diagnostic per-row bank coverage: which CEFR levels contain this exact
      // English concept for this language, and whether the topic target is an
      // exact bank target (MATCH), a different target for the same concept
      // (VARIANT), or the concept is absent from the banks (TOPIC-ONLY).
      const idx = bankIndex[l] ?? new Map<string, { levels: string[]; targets: string[] }>();
      const rows: CoverageRow[] = [];
      const summary: CoverageSummary = { covered: 0, matches: 0, variants: 0, topicOnly: 0 };
      for (const [t, e] of list) {
        const rec = idx.get(norm(e));
        const levelsFound = rec ? [...rec.levels] : [];
        const bankTargets = rec ? [...rec.targets] : [];
        let status: CoverageRow['status'];
        if (!rec) {
          status = 'TOPIC-ONLY';
          summary.topicOnly++;
        } else if (bankTargets.some((x) => norm(x) === norm(t))) {
          status = 'MATCH';
          summary.covered++;
          summary.matches++;
        } else {
          status = 'VARIANT';
          summary.covered++;
          summary.variants++;
        }
        rows.push({ english: e, target: t, levels: levelsFound, status, bankTargets });
      }
      entry.bankCoverage[l] = rows;
      entry.coverageSummary[l] = summary;
    }
    const fileLangs = Object.keys(data);
    const missingLangs = langs.filter((l) => !data[l]);
    const extraLangs = fileLangs.filter((l) => !meta.langs?.[l]);
    for (const l of missingLangs) {
      entry.issues.push(`missing language: ${l}`);
      entry.parityStatus = 'FAIL';
    }
    for (const l of extraLangs) {
      const n = (data[l] ?? []).length;
      entry.issues.push(`extra language: ${l} (${n} pairs)`);
      entry.parityStatus = 'FAIL';
      addTopicPairs(l, n);
    }
    for (const l of langs) {
      const list = data[l] ?? [];
      topicStats.totalTopicPairs += list.length;
      topicStats.topicLanguages.add(l);
      addTopicPairs(l, list.length);
      entry.counts[l] = list.length;
      entry.totalPairs += list.length;
      const expected = meta.langs?.[l];
      if (expected !== undefined && expected !== list.length) {
        entry.issues.push(`manifest count mismatch: ${l} ${expected} != ${list.length}`);
        topicStats.manifestCountMismatch.push(`${topic}[${l}]: manifest ${expected} != file ${list.length}`);
        entry.parityStatus = 'FAIL';
      }
      if (core.length && list.length !== core.length) {
        entry.issues.push(`concept count mismatch: ${l} ${list.length} != core ${core.length}`);
        topicStats.coreMismatches.push(`${topic}[${l}]: count ${list.length} != core ${core.length}`);
        entry.parityStatus = 'FAIL';
      } else if (core.length) {
        const theirs = list.map(([, e]) => norm(e));
        if (JSON.stringify(theirs) !== JSON.stringify(core)) {
          entry.issues.push(`core order/content differs: ${l}`);
          topicStats.coreMismatches.push(`${topic}[${l}]: core order/content differs`);
          entry.parityStatus = 'FAIL';
        }
      }
    }
    entry.languages = langs.length;
    topicLanguageSets[topic] = new Set(fileLangs);
    if (JSON.stringify([...fileLangs].sort()) !== JSON.stringify([...langs].sort())) {
      topicStats.fileLanguageMismatch.push(`${topic}: file langs != manifest langs`);
    }
    for (const pack of packs) {
      if (!meta.langs?.[pack]) topicStats.packCoverageMissing.push(`${topic}: missing ${pack}`);
    }
    topicDetails.push(entry);
  }
  for (const m of topicStats.coreMismatches) failures.push(`topic core: ${m}`);
  for (const m of topicStats.manifestCountMismatch) failures.push(`topic manifest: ${m}`);
  for (const m of topicStats.fileLanguageMismatch) failures.push(`topic: ${m}`);
  for (const m of topicStats.packCoverageMissing) failures.push(`topic: ${m}`);

  // Topic-language coverage summary: common set across topics, pack gaps,
  // topic-only languages, and topics deviating from the common language set.
  const allTopicLangs = new Set<string>();
  const sets = Object.values(topicLanguageSets);
  const commonLangs = sets.length ? new Set(sets[0]) : new Set<string>();
  for (const set of sets) {
    for (const l of set) allTopicLangs.add(l);
    for (const l of [...commonLangs]) if (!set.has(l)) commonLangs.delete(l);
  }
  const topicCoverage: TopicCoverage = {
    totalLanguages: allTopicLangs.size,
    languagesInAllTopics: [...commonLangs].sort(),
    packMissingFromAnyTopic: packs.filter((p) => !commonLangs.has(p)),
    topicOnlyLanguages: [...allTopicLangs].filter((l) => !packs.includes(l)).sort(),
    topicsWithDifferentLanguageSet: Object.entries(topicLanguageSets)
      .filter(([, s]) => s.size !== commonLangs.size || [...s].some((l) => !commonLangs.has(l)))
      .map(([t]) => t),
  };

  // ---- Human-review filters (diagnostic only) -----------------------------
  // Flat VARIANT list: same concept exists in the banks, topic target differs.
  // These are NOT errors — the filter exists for human terminology review.
  const variantRows: VariantRow[] = [];
  for (const t of topicDetails) {
    for (const [lang, rows] of Object.entries(t.bankCoverage ?? {})) {
      for (const r of rows) {
        if (r.status === 'VARIANT') {
          variantRows.push({
            lang,
            topic: t.id,
            english: r.english,
            topicTarget: r.target,
            bankTargets: r.bankTargets,
            levels: r.levels,
            status: r.status,
          });
        }
      }
    }
  }

  // ---- B1 overlap guard (existing test limit) ----------------------------
  const b1Overlap: Record<string, number> = {};
  for (const lang of packs) {
    const prior = new Set<string>();
    for (const lvl of ['A1', 'A2']) {
      for (const [t] of banks[`${lang}-${lvl}`]?.words ?? []) prior.add(norm(t));
    }
    const b1 = banks[`${lang}-B1`]?.words ?? [];
    const overlap = b1.filter(([t]) => prior.has(norm(t))).length;
    b1Overlap[lang] = +(overlap / (b1.length || 1)).toFixed(3);
    if (b1.length > 0 && overlap / b1.length > B1_OVERLAP_MAX) {
      failures.push(
        `${lang}: B1 vs A1/A2 overlap ${((overlap / b1.length) * 100).toFixed(1)}% > ${(B1_OVERLAP_MAX * 100).toFixed(0)}%`,
      );
    }
  }

  // ---- Near-threshold warnings --------------------------------------------
  for (const [lang, c] of Object.entries(crossLevel)) {
    if (c.worstTargetOverlap >= CROSS_LEVEL_TARGET_MAX * 100 * 0.85) {
      warnings.push(`${lang}: target overlap near limit ${c.worstTargetOverlap}% (${c.worstTargetPair})`);
    }
    if (c.worstPairOverlap >= CROSS_LEVEL_PAIR_MAX * 100 * 0.85) {
      warnings.push(`${lang}: pair overlap near limit ${c.worstPairOverlap}% (${c.worstPairPair})`);
    }
  }

  return {
    status: failures.length === 0 ? 'ok' : 'fail',
    counts: {
      packLanguages: packs.length,
      bankFiles: Object.keys(banks).length,
      totalVocabPairs: totalPairs,
      topics: topicStats.topics,
      topicLanguages: topicStats.topicLanguages.size,
      totalTopicPairs: topicStats.totalTopicPairs,
    },
    perLanguage: perLang,
    topicStats: {
      topics: topicStats.topics,
      topicLanguages: topicStats.topicLanguages.size,
      totalTopicPairs: topicStats.totalTopicPairs,
      coreMismatches: topicStats.coreMismatches,
      packCoverageMissing: topicStats.packCoverageMissing,
      manifestCountMismatch: topicStats.manifestCountMismatch,
      fileLanguageMismatch: topicStats.fileLanguageMismatch,
    },
    topicDetails,
    topicLanguageSummary,
    topicCoverage,
    crossLevel,
    isolation,
    terminology,
    b1Overlap,
    variantRows,
    hardErrorRows: terminology.errorRows,
    warnings,
    failures,
  };
}

/** Load real data from disk (Node-only; CLI + server API path). */
export function loadRepo(rootDir?: string): VocabRepo {
  const root = rootDir ?? process.cwd();
  const vocabDir = path.join(root, 'public', 'data', 'vocab');
  const topicsDir = path.join(root, 'public', 'data', 'topics');
  const vocabManifest = JSON.parse(fs.readFileSync(path.join(vocabDir, 'manifest.json'), 'utf8')) as Record<
    string,
    Record<string, number>
  >;
  const topicManifest = JSON.parse(fs.readFileSync(path.join(topicsDir, 'manifest.json'), 'utf8')) as Record<
    string,
    TopicManifestEntry
  >;
  const banks: Record<string, WordBank> = {};
  for (const f of fs.readdirSync(vocabDir)) {
    if (!f.endsWith('.json') || f === 'manifest.json') continue;
    const key = f.replace(/\.json$/, '');
    banks[key] = JSON.parse(fs.readFileSync(path.join(vocabDir, f), 'utf8')) as WordBank;
  }
  const topics: Record<string, Record<string, WordPair[]>> = {};
  for (const f of fs.readdirSync(topicsDir)) {
    if (!f.endsWith('.json') || f === 'manifest.json') continue;
    topics[f.replace(/\.json$/, '')] = JSON.parse(
      fs.readFileSync(path.join(topicsDir, f), 'utf8'),
    ) as Record<string, WordPair[]>;
  }
  return { vocabManifest, banks, topicManifest, topics };
}
