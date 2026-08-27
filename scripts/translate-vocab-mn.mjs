/**
 * Generates offline Mongolian explanations for every bundled English-gloss
 * vocabulary bank, except Mongolian itself.
 *
 * Usage:
 *   node scripts/translate-vocab-mn.mjs --apply
 *
 * The job is resumable: a valid existing companion file is never requested
 * from Azure again. Credentials are loaded from .env.local and never printed.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import nextEnv from '@next/env';

const { loadEnvConfig } = nextEnv;
const APPLY = process.argv.includes('--apply');
// Azure's Translate endpoint accepts up to 1,000 items per request. Larger
// batches reduce rate-limit pressure while remaining well under its 50k
// character request cap for these compact word-bank glosses.
const BATCH_SIZE = 1_000;
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
const provenancePath = join(process.cwd(), 'public', 'data', 'vocab-provenance', 'azure-mongolian-glosses.json');
mkdirSync(outputDir, { recursive: true });

function banks() {
  return readdirSync(vocabDir)
    .filter((file) => /^[a-z]{2,3}-[ABC][12]\.json$/.test(file))
    .map((file) => ({ file, lang: file.slice(0, file.indexOf('-')), level: file.slice(file.lastIndexOf('-') + 1, -5) }))
    .filter(({ lang }) => lang !== 'mn')
    .sort((a, b) => a.file.localeCompare(b.file));
}

async function translate(texts) {
  let lastError;
  for (let attempt = 0; attempt < RETRIES; attempt += 1) {
    try {
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
          signal: AbortSignal.timeout(20_000),
        },
      );
      if (!response.ok) {
        if (response.status !== 429 && response.status < 500) throw new Error(`Azure Translator returned ${response.status}`);
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
    await new Promise((resolve) => setTimeout(resolve, 1_500 * 2 ** attempt));
  }
  throw lastError;
}

const generatedBanks = [];
for (const { file, lang, level } of banks()) {
  const source = JSON.parse(readFileSync(join(vocabDir, file), 'utf8'));
  const outputPath = join(outputDir, file);
  if (!Array.isArray(source.words) || source.words.some((pair) => !Array.isArray(pair) || typeof pair[1] !== 'string')) {
    throw new Error(`${file}: invalid canonical English bank`);
  }
  if (existsSync(outputPath)) {
    const existing = JSON.parse(readFileSync(outputPath, 'utf8'));
    if (existing.sourceLanguage === 'en' && Array.isArray(existing.translations) && existing.translations.length === source.words.length) {
      console.log(`${file}: already complete`);
      generatedBanks.push({ lang, level, pairs: existing.translations.length });
      continue;
    }
  }

  const translations = [];
  for (let start = 0; start < source.words.length; start += BATCH_SIZE) {
    const english = source.words.slice(start, start + BATCH_SIZE).map(([, text]) => text);
    translations.push(...await translate(english));
    console.log(`${file}: ${Math.min(start + BATCH_SIZE, source.words.length)}/${source.words.length}`);
    if (start + BATCH_SIZE < source.words.length) {
      await new Promise((resolve) => setTimeout(resolve, REQUEST_SPACING_MS));
    }
  }
  writeFileSync(outputPath, JSON.stringify({ lang, level, sourceLanguage: 'en', translations }, null, 2) + '\n');
  generatedBanks.push({ lang, level, pairs: translations.length });
}

writeFileSync(
  provenancePath,
  JSON.stringify({
    source: 'Bundled vocabulary banks',
    translationProvider: 'Microsoft Azure Translator',
    sourceLanguage: 'en',
    targetLanguage: 'mn',
    generatedAt: new Date().toISOString(),
    generatedBanks,
  }, null, 2) + '\n',
);
