#!/usr/bin/env node
/**
 * Evoq vocabulary/language health report (read-only).
 *
 * Summarizes pack coverage, topic coverage, manifest integrity, cross-level
 * overlap, language isolation, terminology errors, and topic/core parity.
 * Exits 0 when all hard invariants pass, non-zero when a guard is violated.
 *
 * Thresholds are shared with the CI-gated language audit via
 * `../src/lib/vocabThresholds.ts` so the report can never drift from the
 * enforced limits.
 *
 * Usage:
 *   npm run vocab:health
 *   npm run vocab:health -- --json
 *   npm run vocab:health -- --topic health
 *   npm run vocab:health -- --lang mn
 *
 * --topic and --lang narrow the TEXT report (per-topic detail / per-language
 * coverage card). JSON mode always returns the complete report.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  B1_OVERLAP_MAX,
  CROSS_LEVEL_PAIR_MAX,
  CROSS_LEVEL_TARGET_MAX,
  LANGUAGE_ISOLATION_MAX,
  norm,
  overlapRatio,
  pairSet,
  targetSet,
} from '../src/lib/vocabThresholds.ts';
import { CEFR_LEVELS } from '../src/types/app.ts';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const VOCAB_DIR = path.join(ROOT, 'public', 'data', 'vocab');
const TOPICS_DIR = path.join(ROOT, 'public', 'data', 'topics');

// Hard terminology errors known to be fixed in the data. Keyed by pack
// language -> english concept -> expected translation in both bank and topic.
const HARD_TERMINOLOGY_ERRORS = {
  mn: { temperature: 'температур' },
};

// Canonical pack-language codes (2-letter, as used in bank/topic filenames).
// These mirror src/lib/starterSets.ts (PACK_LANG values). The audit still
// derives its language set from STARTER_LANGS; this list is only the static
// identifier set the report needs without resolving the '@/' alias.
const PACK_CODES = ['ar', 'de', 'es', 'fr', 'hi', 'it', 'ja', 'ko', 'mn', 'pt', 'ru', 'tr', 'zh'];

/** Compute the health report from in-memory data. Pure and testable. */
export function analyze({
  vocabManifest,
  banks,
  topicManifest,
  topics,
  packCodes = PACK_CODES,
  levels = CEFR_LEVELS,
}) {
  const failures = [];
  const warnings = [];
  // Only analyze packs that actually exist in the manifest — the static list
  // is the identifier set, the manifest is the source of truth for presence.
  const packs = packCodes.filter((c) => vocabManifest?.[c]);

  // ---- A. Pack coverage -------------------------------------------------
  const perLang = {};
  let totalPairs = 0;
  for (const lang of packs) {
    const entry = { lang, levels: {}, missing: [], unexpected: [] };
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
  const advertised = new Set();
  for (const [lang, lv] of Object.entries(vocabManifest ?? {})) {
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
    const advertisedCount = vocabManifest?.[fLang]?.[fLvl];
    if (advertisedCount !== undefined && advertisedCount !== bank.words.length) {
      failures.push(`${key}: manifest count ${advertisedCount} != words ${bank.words.length}`);
    }
    if (!Array.isArray(bank.words)) {
      failures.push(`${key}: words is not an array`);
      continue;
    }
    const seenPairs = new Set();
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
  const crossLevel = {};
  for (const lang of packs) {
    const sets = {};
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
          failures.push(`${lang} ${levels[i]}-${levels[j]}: target overlap ${(t * 100).toFixed(1)}% >= ${(CROSS_LEVEL_TARGET_MAX * 100).toFixed(0)}%`);
        }
        if (p >= CROSS_LEVEL_PAIR_MAX) {
          failures.push(`${lang} ${levels[i]}-${levels[j]}: pair overlap ${(p * 100).toFixed(1)}% >= ${(CROSS_LEVEL_PAIR_MAX * 100).toFixed(0)}%`);
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
    const sets = new Map();
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
          failures.push(`isolation: ${l1}-${l2} @${lvl} overlap ${(r * 100).toFixed(1)}% >= ${(LANGUAGE_ISOLATION_MAX * 100).toFixed(0)}%`);
        }
      }
    }
  }
  isolation.worstOverlap = +(isolation.worstOverlap * 100).toFixed(1);

  // ---- F. Terminology health ---------------------------------------------
  const terminology = { configured: 0, violations: [] };
  for (const [pack, entries] of Object.entries(HARD_TERMINOLOGY_ERRORS)) {
    // Skip packs that have no data at all (synthetic fixtures / partial
    // repos) — the check is only meaningful when the pack actually exists.
    const hasPack = levels.some((lvl) => banks[`${pack}-${lvl}`]);
    for (const [en, correct] of Object.entries(entries)) {
      terminology.configured++;
      const bankHits = [];
      for (const lvl of levels) {
        for (const [t, e] of banks[`${pack}-${lvl}`]?.words ?? []) {
          if (norm(e) === en) bankHits.push(norm(t) === norm(correct));
        }
      }
      if (hasPack && (bankHits.length === 0 || !bankHits.every(Boolean))) {
        terminology.violations.push(`${pack}: bank "${en}" != "${correct}"`);
      }
      for (const [topic, data] of Object.entries(topics)) {
        for (const [t, e] of data[pack] ?? []) {
          if (norm(e) === en && norm(t) !== norm(correct)) {
            terminology.violations.push(`${pack} ${topic}: "${en}" -> "${t}" (expected "${correct}")`);
          }
        }
      }
    }
  }
  for (const v of terminology.violations) failures.push(`terminology: ${v}`);

  // ---- G. Topic/core parity ----------------------------------------------
  const topicStats = {
    topics: Object.keys(topicManifest ?? {}).length,
    topicLanguages: new Set(),
    totalTopicPairs: 0,
    coreMismatches: [],
    packCoverageMissing: [],
    manifestCountMismatch: [],
    fileLanguageMismatch: [],
  };
  // Structured per-topic diagnostics (extended Topic Library detail).
  const topicDetails = [];
  const topicLanguageSummary = {};
  const topicLanguageSets = {};
  const addTopicPairs = (lang, n) => {
    topicLanguageSummary[lang] ??= { topicsCovered: 0, totalPairs: 0 };
    topicLanguageSummary[lang].topicsCovered += 1;
    topicLanguageSummary[lang].totalPairs += n;
  };
  for (const [topic, meta] of Object.entries(topicManifest ?? {})) {
    const data = topics[topic];
    const entry = {
      id: topic,
      languages: 0,
      counts: {},
      totalPairs: 0,
      coreSize: 0,
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
  topicStats.topicLanguageCount = topicStats.topicLanguages.size;
  for (const m of topicStats.coreMismatches) failures.push(`topic core: ${m}`);
  for (const m of topicStats.manifestCountMismatch) failures.push(`topic manifest: ${m}`);
  for (const m of topicStats.fileLanguageMismatch) failures.push(`topic: ${m}`);
  for (const m of topicStats.packCoverageMissing) failures.push(`topic: ${m}`);

  // Topic-language coverage summary: common set across topics, pack gaps,
  // topic-only languages, and topics deviating from the common language set.
  const allTopicLangs = new Set();
  const sets = Object.values(topicLanguageSets);
  const commonLangs = sets.length ? new Set(sets[0]) : new Set();
  for (const set of sets) {
    for (const l of set) allTopicLangs.add(l);
    for (const l of [...commonLangs]) if (!set.has(l)) commonLangs.delete(l);
  }
  const topicCoverage = {
    totalLanguages: allTopicLangs.size,
    languagesInAllTopics: [...commonLangs].sort(),
    packMissingFromAnyTopic: packs.filter((p) => !commonLangs.has(p)),
    topicOnlyLanguages: [...allTopicLangs].filter((l) => !packs.includes(l)).sort(),
    topicsWithDifferentLanguageSet: Object.entries(topicLanguageSets)
      .filter(([, s]) => s.size !== commonLangs.size || [...s].some((l) => !commonLangs.has(l)))
      .map(([t]) => t),
  };

  // ---- B1 overlap guard (existing test limit) ----------------------------
  const b1Overlap = {};
  for (const lang of packs) {
    const prior = new Set();
    for (const lvl of ['A1', 'A2']) {
      for (const [t] of banks[`${lang}-${lvl}`]?.words ?? []) prior.add(norm(t));
    }
    const b1 = banks[`${lang}-B1`]?.words ?? [];
    const overlap = b1.filter(([t]) => prior.has(norm(t))).length;
    b1Overlap[lang] = +(overlap / (b1.length || 1)).toFixed(3);
    if (b1.length > 0 && overlap / b1.length > B1_OVERLAP_MAX) {
      failures.push(`${lang}: B1 vs A1/A2 overlap ${((overlap / b1.length) * 100).toFixed(1)}% > ${(B1_OVERLAP_MAX * 100).toFixed(0)}%`);
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
      topicLanguages: topicStats.topicLanguageCount,
      totalTopicPairs: topicStats.totalTopicPairs,
    },
    perLanguage: perLang,
    topicStats,
    topicDetails,
    topicLanguageSummary,
    topicCoverage,
    crossLevel,
    isolation,
    terminology,
    b1Overlap,
    warnings,
    failures,
  };
}

/** Load real data from disk (CLI path). */
export function loadRepo() {
  const vocabManifest = JSON.parse(fs.readFileSync(path.join(VOCAB_DIR, 'manifest.json'), 'utf8'));
  const topicManifest = JSON.parse(fs.readFileSync(path.join(TOPICS_DIR, 'manifest.json'), 'utf8'));
  const banks = {};
  for (const f of fs.readdirSync(VOCAB_DIR)) {
    if (!f.endsWith('.json') || f === 'manifest.json') continue;
    const key = f.replace(/\.json$/, '');
    banks[key] = JSON.parse(fs.readFileSync(path.join(VOCAB_DIR, f), 'utf8'));
  }
  const topics = {};
  for (const f of fs.readdirSync(TOPICS_DIR)) {
    if (!f.endsWith('.json') || f === 'manifest.json') continue;
    topics[f.replace(/\.json$/, '')] = JSON.parse(fs.readFileSync(path.join(TOPICS_DIR, f), 'utf8'));
  }
  return { vocabManifest, banks, topicManifest, topics };
}

/**
 * Render a human-readable summary.
 * opts.topic and opts.lang narrow the topic/per-language sections (text only).
 */
export function renderSummary(report, opts = {}) {
  const L = [];
  L.push(`Evoq vocabulary health: ${report.status.toUpperCase()}`);
  L.push('');
  L.push(`Packs: ${report.counts.packLanguages} languages | ${report.counts.bankFiles} bank files | ${report.counts.totalVocabPairs.toLocaleString()} vocab pairs`);
  L.push(`Topics: ${report.counts.topics} topics | ${report.counts.topicLanguages} languages | ${report.counts.totalTopicPairs.toLocaleString()} topic pairs`);
  L.push('');
  L.push('Pack coverage:');
  for (const e of Object.values(report.perLanguage)) {
    const lv = Object.keys(e.levels).join(',');
    L.push(`  ${e.lang}: ${e.missing.length ? `MISSING ${e.missing.join(',')}` : lv}`);
  }
  if (opts.lang) {
    const pl = report.perLanguage[opts.lang];
    const ts = report.topicLanguageSummary?.[opts.lang];
    L.push('');
    L.push(`Language: ${opts.lang}`);
    if (pl) {
      L.push(`  bank levels: ${Object.entries(pl.levels).map(([l, n]) => `${l} ${n}`).join(', ')}`);
      if (pl.missing.length) L.push(`  missing: ${pl.missing.join(', ')}`);
    } else {
      L.push('  bank levels: (no pack)');
    }
    L.push(
      ts
        ? `  topics covered: ${ts.topicsCovered}/${report.counts.topics}   ${ts.totalPairs.toLocaleString()} pairs`
        : '  topics covered: none',
    );
    L.push('');
  }
  L.push('Cross-level overlap (highest per language):');
  for (const [lang, c] of Object.entries(report.crossLevel)) {
    L.push(`  ${lang}: target ${c.worstTargetOverlap}% (${c.worstTargetPair}) | pair ${c.worstPairOverlap}% (${c.worstPairPair})`);
  }
  L.push('');
  L.push('Topic detail:');
  const topicRows = opts.topic
    ? report.topicDetails.filter((t) => t.id === opts.topic)
    : report.topicDetails;
  for (const t of topicRows) {
    const counts = Object.values(t.counts);
    const per =
      counts.length && counts.every((c) => c === counts[0])
        ? `${counts[0]}/lang`
        : `${Math.min(...counts)}-${Math.max(...counts)}/lang`;
    L.push(
      `  ${t.id.padEnd(12)} ${String(t.languages).padStart(2)} langs   ${per.padStart(9)}   ${String(t.totalPairs).padStart(4)} total   ${t.parityStatus}`,
    );
  }
  if (opts.topic) {
    const t = report.topicDetails.find((x) => x.id === opts.topic);
    if (t) {
      L.push('');
      L.push(`Topic ${t.id} per-language:`);
      for (const [lang, n] of Object.entries(t.counts)) {
        L.push(`  ${lang.padEnd(4)} ${String(n).padStart(5)} pairs`);
      }
      if (t.issues.length) {
        L.push('  issues:');
        for (const i of t.issues) L.push(`    - ${i}`);
      }
    } else {
      L.push(`  (unknown topic: ${opts.topic})`);
    }
  }
  L.push('');
  L.push('Per-language topic totals:');
  for (const [lang, s] of Object.entries(report.topicLanguageSummary ?? {})) {
    L.push(
      `  ${lang.padEnd(4)} ${String(s.topicsCovered).padStart(2)}/${report.counts.topics}   ${s.totalPairs.toLocaleString()} pairs`,
    );
  }
  L.push('');
  const cov = report.topicCoverage;
  if (cov) {
    L.push('Topic coverage:');
    L.push(
      `  languages in all topics: ${cov.languagesInAllTopics.length} (${cov.languagesInAllTopics.join(', ')})`,
    );
    L.push(
      `  pack languages missing from any topic: ${cov.packMissingFromAnyTopic.length ? cov.packMissingFromAnyTopic.join(', ') : 'none'}`,
    );
    L.push(
      `  topic-only languages: ${cov.topicOnlyLanguages.length ? cov.topicOnlyLanguages.join(', ') : 'none'}`,
    );
    L.push(
      `  topics with a different language set: ${cov.topicsWithDifferentLanguageSet.length ? cov.topicsWithDifferentLanguageSet.join(', ') : 'none'}`,
    );
    L.push('');
  }
  L.push(`Language isolation: worst ${report.isolation.worstOverlap}% (${report.isolation.langPair} @ ${report.isolation.level})`);
  L.push(`B1 overlap: ${Object.entries(report.b1Overlap).map(([l, v]) => `${l} ${(v * 100).toFixed(0)}%`).join(', ')}`);
  L.push(`Terminology: ${report.terminology.violations.length}/${report.terminology.configured} violations`);
  L.push('');
  if (report.warnings.length) {
    L.push('Warnings (near threshold):');
    for (const w of report.warnings) L.push(`  ! ${w}`);
    L.push('');
  }
  if (report.failures.length) {
    L.push('Failures:');
    for (const f of report.failures) L.push(`  ✗ ${f}`);
  } else {
    L.push('All hard invariants pass.');
  }
  return L.join('\n');
}

// CLI entry point.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const json = process.argv.includes('--json');
  let topicFilter;
  let langFilter;
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--topic') topicFilter = args[i + 1];
    if (args[i] === '--lang') langFilter = args[i + 1];
  }
  const repo = loadRepo();
  const report = analyze(repo);
  if (json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(renderSummary(report, { topic: topicFilter, lang: langFilter }));
  }
  process.exit(report.status === 'ok' ? 0 : 1);
}
