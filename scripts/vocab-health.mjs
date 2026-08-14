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
  for (const [topic, meta] of Object.entries(topicManifest ?? {})) {
    const data = topics[topic];
    if (!data) {
      failures.push(`topic ${topic}: no file on disk`);
      continue;
    }
    const langs = Object.keys(meta.langs ?? {});
    const ref = langs[0];
    if (ref && data[ref]) {
      const core = data[ref].map(([, e]) => norm(e));
      for (const l of langs) {
        const list = data[l] ?? [];
        topicStats.totalTopicPairs += list.length;
        topicStats.topicLanguages.add(l);
        if (list.length !== core.length) {
          topicStats.coreMismatches.push(`${topic}[${l}]: count ${list.length} != core ${core.length}`);
        } else {
          const theirs = list.map(([, e]) => norm(e));
          if (JSON.stringify(theirs) !== JSON.stringify(core)) {
            topicStats.coreMismatches.push(`${topic}[${l}]: core order/content differs`);
          }
        }
        const expected = meta.langs?.[l];
        if (expected !== undefined && expected !== list.length) {
          topicStats.manifestCountMismatch.push(`${topic}[${l}]: manifest ${expected} != file ${list.length}`);
        }
      }
    }
    const fileLangs = Object.keys(data);
    const metaLangs = Object.keys(meta.langs ?? {});
    if (JSON.stringify([...fileLangs].sort()) !== JSON.stringify([...metaLangs].sort())) {
      topicStats.fileLanguageMismatch.push(`${topic}: file langs != manifest langs`);
    }
    for (const pack of packs) {
      if (!meta.langs?.[pack]) topicStats.packCoverageMissing.push(`${topic}: missing ${pack}`);
    }
  }
  topicStats.topicLanguageCount = topicStats.topicLanguages.size;
  for (const m of topicStats.coreMismatches) failures.push(`topic core: ${m}`);
  for (const m of topicStats.manifestCountMismatch) failures.push(`topic manifest: ${m}`);
  for (const m of topicStats.fileLanguageMismatch) failures.push(`topic: ${m}`);
  for (const m of topicStats.packCoverageMissing) failures.push(`topic: ${m}`);

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

/** Render a human-readable summary. */
export function renderSummary(report) {
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
  L.push('');
  L.push('Cross-level overlap (highest per language):');
  for (const [lang, c] of Object.entries(report.crossLevel)) {
    L.push(`  ${lang}: target ${c.worstTargetOverlap}% (${c.worstTargetPair}) | pair ${c.worstPairOverlap}% (${c.worstPairPair})`);
  }
  L.push('');
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
  const repo = loadRepo();
  const report = analyze(repo);
  if (json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(renderSummary(report));
  }
  process.exit(report.status === 'ok' ? 0 : 1);
}
