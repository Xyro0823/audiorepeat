/**
 * Builds first-stage A1 phrase banks from Tatoeba's English parallel exports.
 *
 * Usage:
 *   node scripts/import-tatoeba-a1.mjs <directory-containing-decompressed-tsv>
 *
 * The data directory must contain eng_sentences.tsv plus, for each language,
 * <tatoeba-code>_sentences.tsv and eng-<tatoeba-code>_links.tsv.  The source
 * files are intentionally kept outside the repository; every generated bank
 * carries only the selected, short learning pairs. See THIRD_PARTY_NOTICES.md.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const [, , rawSourceDir] = process.argv;
if (!rawSourceDir) {
  throw new Error('Usage: node scripts/import-tatoeba-a1.mjs <source-directory>');
}

const sourceDir = resolve(rawSourceDir);
const outputDir = join(process.cwd(), 'public', 'data', 'vocab');
const TARGET_COUNT = 250;

// App pack key -> ISO 639-3 code used by Tatoeba's per-language exports.
const LANGUAGES = {
  fa: 'pes', nl: 'nld', sv: 'swe', pl: 'pol', el: 'ell', he: 'heb',
  vi: 'vie', th: 'tha', id: 'ind', sw: 'swh', uk: 'ukr', cs: 'ces',
  fi: 'fin', nb: 'nob', da: 'dan', fil: 'tgl',
};

function readTsv(file) {
  return readFileSync(join(sourceDir, file), 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => line.split('\t'));
}

function sentenceMap(file) {
  const result = new Map();
  for (const [id, , text] of readTsv(file)) {
    if (id && text) result.set(id, text.trim());
  }
  return result;
}

function normalise(text) {
  return text.toLocaleLowerCase().replace(/\s+/g, ' ').trim();
}

function isA1Candidate(target, english) {
  if (!target || !english || target.length > 90 || english.length > 90) return false;
  if (english.split(/\s+/).length > 12) return false;
  if (/\d|https?:\/\/|[{}<>]/.test(target) || /\d|https?:\/\/|[{}<>]/.test(english)) return false;
  // Names and fictional-source sentences dominate public parallel corpora and
  // make poor first lessons. Keep neutral, reusable everyday language.
  if (/\b(Tom|Mary|John|Jack|Bill|Alice|Bob)\b/i.test(english)) return false;
  return true;
}

const english = sentenceMap('eng_sentences.tsv');
mkdirSync(outputDir, { recursive: true });

for (const [pack, code] of Object.entries(LANGUAGES)) {
  const target = sentenceMap(`${code}_sentences.tsv`);
  const seenTarget = new Set();
  const seenEnglish = new Set();
  const words = [];

  for (const [englishId, targetId] of readTsv(`eng-${code}_links.tsv`)) {
    const targetText = target.get(targetId);
    const englishText = english.get(englishId);
    if (!targetText || !englishText || !isA1Candidate(targetText, englishText)) continue;
    const targetKey = normalise(targetText);
    const englishKey = normalise(englishText);
    if (seenTarget.has(targetKey) || seenEnglish.has(englishKey)) continue;
    seenTarget.add(targetKey);
    seenEnglish.add(englishKey);
    words.push([targetText, englishText]);
    if (words.length === TARGET_COUNT) break;
  }

  if (words.length < TARGET_COUNT) {
    throw new Error(`${pack}: only found ${words.length}/${TARGET_COUNT} usable A1 pairs`);
  }
  const file = join(outputDir, `${pack}-A1.json`);
  writeFileSync(file, JSON.stringify({ lang: pack, level: 'A1', words }, null, 2) + '\n');
  console.log(`${pack}: wrote ${words.length} A1 pairs`);
}
