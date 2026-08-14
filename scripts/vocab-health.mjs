#!/usr/bin/env node
/**
 * Evoq vocabulary/language health report (read-only).
 *
 * Thin CLI wrapper around the shared analysis in
 * `../src/lib/vocabHealth.ts` — the same single source of truth the CI-gated
 * language audit and the admin diagnostics API use. Summarizes pack coverage,
 * topic coverage, manifest integrity, cross-level overlap, language
 * isolation, terminology errors, and topic/core parity. Exits 0 when all hard
 * invariants pass, non-zero when a guard is violated.
 *
 * Usage:
 *   npm run vocab:health
 *   npm run vocab:health -- --json
 *   npm run vocab:health -- --topic health
 *   npm run vocab:health -- --lang mn
 *   npm run vocab:health -- --only-variants
 *   npm run vocab:health -- --errors-only
 *
 * --topic / --lang narrow the TEXT report; --only-variants / --errors-only
 * are human-review filters. JSON mode always returns the complete report.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyze, loadRepo } from '../src/lib/vocabHealth.ts';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

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
      const targetLang = opts.lang && t.targets?.[opts.lang] ? opts.lang : undefined;
      if (targetLang) {
        const targets = t.targets[targetLang];
        const coverage = t.bankCoverage?.[targetLang];
        const nw = Math.max(1, String(t.core.length).length);
        const ew = Math.max(7, ...t.core.map((c) => c.length));
        const tw = Math.max(6, ...targets.map((x) => x.length));
        const bw = coverage
          ? Math.max(4, ...coverage.map((r) => (r.levels.length ? r.levels.join(', ').length : 1)))
          : 4;
        L.push('');
        L.push(`Language: ${targetLang}`);
        L.push(
          `  ${'#'.padStart(nw)}  ${'English'.padEnd(ew)}  ${'Target'.padEnd(tw)}  ${'Bank'.padEnd(bw)}  Status`,
        );
        t.core.forEach((c, i) => {
          const row = coverage?.[i];
          const bank = row && row.levels.length ? row.levels.join(', ') : '—';
          const status = row ? row.status : '';
          L.push(
            `  ${String(i + 1).padStart(nw)}  ${c.padEnd(ew)}  ${targets[i].padEnd(tw)}  ${bank.padEnd(bw)}  ${status}`,
          );
        });
        const summary = coverage ? t.coverageSummary?.[targetLang] : undefined;
        if (summary) {
          const pct = Math.round((summary.covered / Math.max(1, t.core.length)) * 100);
          L.push('');
          L.push('Topic concepts covered by CEFR banks:');
          L.push(
            `  covered: ${summary.covered} (${pct}%)  matches: ${summary.matches}  variants: ${summary.variants}  topic-only: ${summary.topicOnly}`,
          );
        }
      } else {
        if (t.core?.length) {
          L.push('');
          L.push(`Core concepts (${t.core.length}):`);
          t.core.forEach((c, i) => L.push(`  ${String(i + 1).padStart(2)}. ${c}`));
        }
        if (opts.lang) {
          L.push('');
          L.push(`  (language ${opts.lang} is not present in topic ${t.id})`);
        }
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

  // ---- Human-review filters (diagnostic only, never a correctness gate) --
  if (opts.onlyVariants && opts.errorsOnly) {
    throw new Error('--only-variants and --errors-only cannot be combined');
  }
  if (opts.errorsOnly) {
    L.push('');
    L.push('Hard terminology errors:');
    const rows = report.hardErrorRows ?? [];
    if (!rows.length) {
      L.push('  none');
    } else {
      for (const r of rows) {
        L.push(`  ${r.pack} ${r.source}: "${r.english}" -> "${r.target}" (expected "${r.expected}")`);
      }
    }
  } else if (opts.onlyVariants) {
    let rows = report.variantRows ?? [];
    if (opts.topic) rows = rows.filter((r) => r.topic === opts.topic);
    if (opts.lang) rows = rows.filter((r) => r.lang === opts.lang);
    L.push('');
    L.push('VARIANT rows (human review only):');
    if (!rows.length) {
      L.push('  none');
    } else {
      L.push('  lang | topic | english | topicTarget | bankTargets | levels | status');
      for (const r of rows) {
        L.push(
          `  ${r.lang} | ${r.topic} | ${r.english} | ${r.topicTarget} | ${(r.bankTargets ?? []).join(' | ')} | ${r.levels.join(',')} | ${r.status}`,
        );
      }
    }
  }
  return L.join('\n');
}

// CLI entry point.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const json = process.argv.includes('--json');
  let topicFilter;
  let langFilter;
  const onlyVariants = process.argv.includes('--only-variants');
  const errorsOnly = process.argv.includes('--errors-only');
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--topic') topicFilter = args[i + 1];
    if (args[i] === '--lang') langFilter = args[i + 1];
  }
  const report = analyze(loadRepo(ROOT));
  if (json) {
    // Filters are display-oriented; JSON always returns the complete report.
    console.log(JSON.stringify(report, null, 2));
  } else {
    try {
      console.log(renderSummary(report, { topic: topicFilter, lang: langFilter, onlyVariants, errorsOnly }));
    } catch (e) {
      console.error(e.message);
      process.exit(1);
    }
  }
  process.exit(report.status === 'ok' ? 0 : 1);
}
