/**
 * Pure view helpers for the admin Language Diagnostics page
 * (/admin/diagnostics). All logic is extracted here so it can be unit-tested
 * without rendering React — the component only selects/renders.
 *
 * Types mirror the report shape produced by `src/lib/vocabHealth.ts` (the
 * same analysis the vocab:health CLI uses).
 */
import type { HealthReport, TopicDetail, VariantRow } from './vocabHealth';

/** Per-language aggregate view for the language selector card. */
export interface LanguageSummary {
  lang: string;
  levels: Array<[level: string, count: number]>;
  totalWords: number;
  worstTargetOverlap: number;
  worstTargetPair: string;
  worstPairOverlap: number;
  worstPairPair: string;
  topicsCovered: number;
  totalTopicPairs: number;
  matches: number;
  variants: number;
  topicOnly: number;
}

/** One row of the topic+language concept table. */
export interface ConceptRow {
  index: number;
  english: string;
  target: string;
  levels: string[];
  status: 'MATCH' | 'VARIANT' | 'TOPIC-ONLY';
  bankTargets: string[];
}

export type RowFilter = 'all' | 'MATCH' | 'VARIANT' | 'TOPIC-ONLY';

/** Aggregate the selected language's health from the full report. */
export function languageSummary(report: HealthReport, lang: string): LanguageSummary | null {
  const pl = report.perLanguage[lang];
  if (!pl) return null;
  const ts = report.topicLanguageSummary[lang];
  const cl = report.crossLevel[lang];
  let matches = 0;
  let variants = 0;
  let topicOnly = 0;
  for (const t of report.topicDetails) {
    const s = t.coverageSummary?.[lang];
    if (!s) continue;
    matches += s.matches;
    variants += s.variants;
    topicOnly += s.topicOnly;
  }
  return {
    lang,
    levels: Object.entries(pl.levels),
    totalWords: Object.values(pl.levels).reduce((a, b) => a + b, 0),
    worstTargetOverlap: cl?.worstTargetOverlap ?? 0,
    worstTargetPair: cl?.worstTargetPair ?? '',
    worstPairOverlap: cl?.worstPairOverlap ?? 0,
    worstPairPair: cl?.worstPairPair ?? '',
    topicsCovered: ts?.topicsCovered ?? 0,
    totalTopicPairs: ts?.totalPairs ?? 0,
    matches,
    variants,
    topicOnly,
  };
}

/**
 * Build the ordered concept rows for a topic+language pair. Returns null when
 * the topic or language is not present. Rows align 1:1 with the topic's
 * canonical English core (index = core position + 1).
 */
export function topicConceptRows(report: HealthReport, topic: string, lang: string): ConceptRow[] | null {
  const t: TopicDetail | undefined = report.topicDetails.find((x) => x.id === topic);
  if (!t) return null;
  const coverage = t.bankCoverage?.[lang];
  const targets = t.targets?.[lang];
  if (!coverage || !targets) return null;
  return t.core.map((english, i) => {
    const row = coverage[i];
    return {
      index: i + 1,
      english,
      target: targets[i],
      levels: row?.levels ?? [],
      status: row?.status ?? 'TOPIC-ONLY',
      bankTargets: row?.bankTargets ?? [],
    };
  });
}

/** Apply a MATCH/VARIANT/TOPIC-ONLY filter and an English/target search. */
export function filterConceptRows(rows: ConceptRow[], filter: RowFilter, search: string): ConceptRow[] {
  const q = search.trim().toLowerCase();
  return rows.filter((r) => {
    if (filter !== 'all' && r.status !== filter) return false;
    if (q && !r.english.toLowerCase().includes(q) && !r.target.toLowerCase().includes(q)) return false;
    return true;
  });
}

export interface VariantSearchOpts {
  lang?: string;
  topic?: string;
  search?: string;
  limit?: number;
}

/**
 * Filter the flat VARIANT review list by language/topic and a free-text
 * search across English, topic target and bank targets. Always returns in the
 * report's canonical order.
 */
export function filterVariants(report: HealthReport, opts: VariantSearchOpts = {}): VariantRow[] {
  let rows = report.variantRows;
  if (opts.lang) rows = rows.filter((r) => r.lang === opts.lang);
  if (opts.topic) rows = rows.filter((r) => r.topic === opts.topic);
  const q = (opts.search ?? '').trim().toLowerCase();
  if (q) {
    rows = rows.filter(
      (r) =>
        r.english.toLowerCase().includes(q) ||
        r.topicTarget.toLowerCase().includes(q) ||
        (r.bankTargets ?? []).some((t) => t.toLowerCase().includes(q)),
    );
  }
  return opts.limit !== undefined ? rows.slice(0, opts.limit) : rows;
}

/** Topic list in manifest order with labels resolved by the caller. */
export function topicList(report: HealthReport): TopicDetail[] {
  return report.topicDetails;
}
