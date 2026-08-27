/**
 * Builds first-stage A1 phrase banks from Tatoeba's English parallel exports.
 *
 * Usage:
 *   node scripts/import-tatoeba-a1.mjs <directory-containing-decompressed-tsv>
 *
 * The data directory must contain eng_sentences.tsv plus, for each language,
 * <tatoeba-code>_sentences.tsv. It must also contain either the historical
 * per-language eng-<tatoeba-code>_links.tsv files or Tatoeba's current
 * all-language links.tsv export. The source files are intentionally kept
 * outside the repository; every generated bank carries only the selected,
 * short learning pairs. See THIRD_PARTY_NOTICES.md.
 */
import { createReadStream, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createInterface } from 'node:readline';

const [, , rawSourceDir] = process.argv;
if (!rawSourceDir) {
  throw new Error('Usage: node scripts/import-tatoeba-a1.mjs <source-directory>');
}

const sourceDir = resolve(rawSourceDir);
const outputDir = join(process.cwd(), 'public', 'data', 'vocab');
const provenanceDir = join(process.cwd(), 'public', 'data', 'vocab-provenance');
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

async function globalLinksByPack(englishIds, targetMaps) {
  // The official tarball currently expands to links.csv despite using the
  // same tab-separated two-column structure documented for links.tsv.
  const linksFile = existsSync(join(sourceDir, 'links.tsv')) ? 'links.tsv' : 'links.csv';
  if (!existsSync(join(sourceDir, linksFile))) {
    throw new Error(`missing ${linksFile}`);
  }

  // Index every selected target sentence by pack code, then stream the very
  // large all-language links export once. The earlier importer parsed the
  // 450 MB file separately for every language, which was both slow and prone
  // to exhausting memory on an ordinary laptop.
  const targetToPack = new Map();
  for (const [pack, sentences] of Object.entries(targetMaps)) {
    for (const id of sentences.keys()) targetToPack.set(id, pack);
  }
  const pairs = new Map(Object.keys(targetMaps).map((pack) => [pack, []]));
  const stream = createInterface({
    input: createReadStream(join(sourceDir, linksFile), { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });
  for await (const line of stream) {
    const tab = line.indexOf('\t');
    if (tab < 1) continue;
    const englishId = line.slice(0, tab);
    const targetId = line.slice(tab + 1);
    const pack = targetToPack.get(targetId);
    if (pack && englishIds.has(englishId)) pairs.get(pack).push([englishId, targetId]);
  }
  return pairs;
}

function normalise(text) {
  return text
    .toLocaleLowerCase()
    .replace(/[.,!?¿¡;:'"…]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const A1_ENGLISH = new Set(
  `a am an and are at be because can come do for from go good happy have he hello here how I in is it like little love me my name no not now of on or please she sleep so speak that the there they this to today tomorrow too want we what where who why will with yes you your`
    .toLowerCase()
    .split(/\s+/),
);
const UNSUITABLE = /\b(?:abuse|alcohol|assault|beer|bullet|cigarette|crime|dead|death|die|died|drugs?|drunk|freaking|gun|hate|kill(?:ed|ing|s)?|murder|naked|police|porn|prison|sex|shoot(?:ing)?|suicide|violence|war|weapon)\b/i;
const COMMON_NAMES = /\b(?:Alice|Allen|Bill|Bob|Jack|John|Mary|Muiriel|Tom|Trang|Yoshida)\b/i;

function isA1Candidate(target, english) {
  if (!target || !english || target.length > 64 || english.length > 64) return false;
  const tokens = english.match(/[A-Za-z]+(?:'[A-Za-z]+)?/g) ?? [];
  if (tokens.length < 2 || tokens.length > 8) return false;
  if (/\d|https?:\/\/|[{}<>";:]/.test(target) || /\d|https?:\/\/|[{}<>";:]/.test(english)) return false;
  if (UNSUITABLE.test(english) || COMMON_NAMES.test(english)) return false;
  return true;
}

function a1Score(target, english) {
  const tokens = (english.match(/[A-Za-z]+(?:'[A-Za-z]+)?/g) ?? []).map((word) => word.toLowerCase());
  const unfamiliar = tokens.filter((word) => !A1_ENGLISH.has(word)).length;
  // Prefer compact everyday sentences. Unknown words are deliberately the
  // strongest signal; length only breaks ties between equally simple options.
  return unfamiliar * 100 + tokens.length * 5 + target.length / 100;
}

const english = sentenceMap('eng_sentences.tsv');
mkdirSync(outputDir, { recursive: true });
mkdirSync(provenanceDir, { recursive: true });
const generatedBanks = [];
const targetMaps = Object.fromEntries(
  Object.entries(LANGUAGES).map(([pack, code]) => [pack, sentenceMap(`${code}_sentences.tsv`)]),
);
const globalLinks = await globalLinksByPack(english, targetMaps);

for (const [pack, code] of Object.entries(LANGUAGES)) {
  const target = targetMaps[pack];
  const candidates = [];

  const pairFile = `eng-${code}_links.tsv`;
  const links = existsSync(join(sourceDir, pairFile)) ? readTsv(pairFile) : globalLinks.get(pack);
  for (const [englishId, targetId] of links) {
    const targetText = target.get(targetId);
    const englishText = english.get(englishId);
    if (!targetText || !englishText || !isA1Candidate(targetText, englishText)) continue;
    const targetKey = normalise(targetText);
    const englishKey = normalise(englishText);
    candidates.push([targetText, englishText, a1Score(targetText, englishText), targetKey, englishKey]);
  }

  candidates.sort((a, b) => a[2] - b[2] || a[1].localeCompare(b[1]));
  const seenTarget = new Set();
  const seenEnglish = new Set();
  const words = [];
  for (const [targetText, englishText, , targetKey, englishKey] of candidates) {
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
  generatedBanks.push({ lang: pack, level: 'A1', pairs: words.length });
  console.log(`${pack}: wrote ${words.length} A1 pairs`);
}

// Keep attribution adjacent to the generated content, rather than relying on
// a developer to remember it in a release note. The raw Tatoeba archives stay
// outside the repository; this record is small, public, and auditable.
writeFileSync(
  join(provenanceDir, 'tatoeba-a1.json'),
  JSON.stringify(
    {
      sourceId: 'tatoeba',
      generatedAt: new Date().toISOString(),
      sourceUrl: 'https://tatoeba.org/en/downloads',
      license: 'CC BY 2.0 FR',
      licenseUrl: 'https://creativecommons.org/licenses/by/2.0/fr/deed.en',
      attribution: 'Sentences from Tatoeba.org, licensed under CC BY 2.0 FR.',
      selection: {
        targetPairsPerLanguage: TARGET_COUNT,
        maxCharactersPerSide: 64,
        maxEnglishWords: 8,
        exclusions: ['numbers', 'URLs', 'markup', 'quotes', 'common personal names', 'unsafe topics'],
        ranking: 'Prioritises short sentences made from common beginner English words.',
      },
      generatedBanks,
    },
    null,
    2,
  ) + '\n',
);
