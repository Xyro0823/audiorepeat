/**
 * Regenerates public/data/vocab/manifest.json from the actual word-pack files
 * (public/data/vocab/<lang>-<level>.json). Run after adding or editing packs:
 *
 *   node scripts/generate-vocab-manifest.mjs
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'data', 'vocab');

const manifest = {};
const files = readdirSync(DIR).filter((f) => f.endsWith('.json') && f !== 'manifest.json');

for (const file of files) {
  const m = /^([a-z]{2})-([A-C][12])\.json$/.exec(file);
  if (!m) {
    console.warn(`Skipping ${file}: unexpected name`);
    continue;
  }
  const [, lang, level] = m;
  const data = JSON.parse(readFileSync(join(DIR, file), 'utf8'));
  const count = Array.isArray(data.words) ? data.words.length : 0;
  manifest[lang] ??= {};
  manifest[lang][level] = count;
}

// Keep a stable key order: languages alphabetically, levels A1->C2.
const levelOrder = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const out = {};
for (const lang of Object.keys(manifest).sort()) {
  out[lang] = {};
  for (const level of levelOrder) {
    if (manifest[lang][level] !== undefined) out[lang][level] = manifest[lang][level];
  }
}

writeFileSync(join(DIR, 'manifest.json'), JSON.stringify(out, null, 2) + '\n');
console.log('manifest.json updated:');
console.log(JSON.stringify(out));
