/**
 * Generates offline Mongolian explanations for the curated Tatoeba A1 banks.
 *
 * Usage:
 *   node scripts/translate-tatoeba-a1-mn.mjs --apply
 *
 * Reads Azure Translator credentials from .env.local through Next's official
 * environment loader. Credentials are never printed or written to output.
 * The generated files are index-aligned with public/data/vocab/<lang>-A1.json.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import nextEnv from '@next/env';

const { loadEnvConfig } = nextEnv;

const APPLY = process.argv.includes('--apply');
const FORCE = process.argv.includes('--force');
const LANGUAGES = ['cs', 'da', 'el', 'fa', 'fi', 'fil', 'he', 'id', 'nb', 'nl', 'pl', 'sv', 'sw', 'th', 'uk', 'vi'];
const BATCH_SIZE = 25;
const RETRIES = 6;
const REQUEST_SPACING_MS = 1_500;

if (!APPLY) throw new Error('Refusing to call Azure. Re-run with --apply after reviewing this script.');

loadEnvConfig(process.cwd());
const key = process.env.AZURE_TRANSLATOR_KEY?.trim();
const region = process.env.AZURE_TRANSLATOR_REGION?.trim().toLowerCase();
if (!key || !region || !/^[a-z0-9-]{2,32}$/.test(region)) {
  throw new Error('Azure Translator is not configured in .env.local');
}

const vocabDir = join(process.cwd(), 'public', 'data', 'vocab');
const outputDir = join(process.cwd(), 'public', 'data', 'vocab-mn');
const provenanceDir = join(process.cwd(), 'public', 'data', 'vocab-provenance');
mkdirSync(outputDir, { recursive: true });
mkdirSync(provenanceDir, { recursive: true });

async function translateBatch(texts) {
  let lastError;
  for (let attempt = 0; attempt < RETRIES; attempt += 1) {
    try {
      // The source files already contain the canonical English meaning for
      // each phrase. Translating that meaning (rather than attempting to
      // detect a two-word foreign phrase) keeps the Mongolian explanation
      // faithful to the curated learning pair.
      const response = await fetch(
        'https://api.cognitive.microsofttranslator.com/translate?api-version=3.0&from=en&to=mn',
        {
          method: 'POST',
          headers: {
            'Ocp-Apim-Subscription-Key': key,
            'Ocp-Apim-Subscription-Region': region,
            'Content-Type': 'application/json; charset=utf-8',
            'X-ClientTraceId': crypto.randomUUID(),
          },
          body: JSON.stringify(texts.map((Text) => ({ Text }))),
          signal: AbortSignal.timeout(15_000),
        },
      );
      if (!response.ok) {
        const retryable = response.status === 429 || response.status >= 500;
        if (!retryable) throw new Error(`Azure Translator returned ${response.status}`);
        lastError = new Error(`Azure Translator returned ${response.status}`);
      } else {
        const data = await response.json();
        const translations = data.map((entry) => entry?.translations?.[0]?.text?.trim());
        if (translations.length !== texts.length || translations.some((text) => typeof text !== 'string' || !text)) {
          throw new Error('Azure Translator returned an invalid response');
        }
        return translations;
      }
    } catch (error) {
      lastError = error;
      if (attempt === RETRIES - 1) break;
    }
    // Azure may briefly throttle a bulk maintenance job. Back off before
    // retrying instead of burning requests or leaving a partial bank behind.
    await new Promise((resolve) => setTimeout(resolve, 1_500 * 2 ** attempt));
  }
  throw lastError;
}

const generatedBanks = [];
for (const lang of LANGUAGES) {
  const sourcePath = join(vocabDir, `${lang}-A1.json`);
  const outputPath = join(outputDir, `${lang}-A1.json`);
  const source = JSON.parse(readFileSync(sourcePath, 'utf8'));
  if (!Array.isArray(source.words) || source.words.length !== 250) {
    throw new Error(`${lang}: expected exactly 250 curated A1 pairs`);
  }
  if (!FORCE && existsSync(outputPath)) {
    const existing = JSON.parse(readFileSync(outputPath, 'utf8'));
    if (
      existing.sourceLanguage === 'en' &&
      Array.isArray(existing.translations) &&
      existing.translations.length === source.words.length
    ) {
      console.log(`${lang}: already has ${existing.translations.length} Mongolian explanations`);
      generatedBanks.push({ lang, level: 'A1', pairs: existing.translations.length });
      continue;
    }
  }
  const translations = [];
  for (let start = 0; start < source.words.length; start += BATCH_SIZE) {
    const batch = source.words.slice(start, start + BATCH_SIZE).map(([, english]) => english);
    translations.push(...await translateBatch(batch));
    console.log(`${lang}: ${Math.min(start + BATCH_SIZE, source.words.length)}/${source.words.length}`);
    if (start + BATCH_SIZE < source.words.length) {
      await new Promise((resolve) => setTimeout(resolve, REQUEST_SPACING_MS));
    }
  }
  writeFileSync(outputPath, JSON.stringify({ lang, level: 'A1', sourceLanguage: 'en', translations }, null, 2) + '\n');
  generatedBanks.push({ lang, level: 'A1', pairs: translations.length });
}

writeFileSync(
  join(provenanceDir, 'tatoeba-a1-mn.json'),
  JSON.stringify({
    sourceId: 'tatoeba',
    derivedFrom: 'tatoeba-a1.json',
    translationProvider: 'Microsoft Azure Translator',
    targetLanguage: 'mn',
    sourceLanguage: 'en (the canonical meaning paired with each Tatoeba sentence)',
    generatedAt: new Date().toISOString(),
    generatedBanks,
  }, null, 2) + '\n',
);
