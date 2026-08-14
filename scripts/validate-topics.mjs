/**
 * Validates every topic pack under public/data/topics and regenerates
 * manifest.json from the actual word counts.
 *
 * Checks per file:
 *  - valid JSON
 *  - all 15 supported languages present
 *  - each list has >= 30 words
 *  - no duplicate translations within a language list (would break quiz distractors)
 *  - no duplicate target+translation pairs
 *
 * Usage: node scripts/validate-topics.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const TOPICS_DIR = 'public/data/topics';
const LANGS = ['es', 'fr', 'de', 'ja', 'it', 'pt', 'ko', 'zh', 'ru', 'ar', 'hi', 'tr', 'nl', 'sv', 'mn'];
const LABELS = {
  travel: { label: 'Travel & Airport', emoji: '✈️' },
  business: { label: 'Business & Work', emoji: '💼' },
  food: { label: 'Food & Dining', emoji: '🍽️' },
  tech: { label: 'Tech & IT', emoji: '💻' },
  health: { label: 'Health & Body', emoji: '🩺' },
  shopping: { label: 'Shopping & Stores', emoji: '🛍️' },
  smalltalk: { label: 'Small Talk', emoji: '💬' },
  education: { label: 'Education & School', emoji: '🎓' },
  family: { label: 'Family & Relationships', emoji: '👨‍👩‍👧' },
  sports: { label: 'Sports & Fitness', emoji: '🏋️' },
  emotions: { label: 'Emotions & Feelings', emoji: '😊' },
  nature: { label: 'Nature & Weather', emoji: '🌦️' },
  home: { label: 'Home & Furniture', emoji: '🏠' },
  time: { label: 'Time & Dates', emoji: '⏰' },
  money: { label: 'Money & Banking', emoji: '💰' },
  animals: { label: 'Animals & Pets', emoji: '🐾' },
  colors: { label: 'Colors & Shapes', emoji: '🎨' },
  body: { label: 'Body & Appearance', emoji: '🪞' },
  city: { label: 'City Life', emoji: '🏙️' },
};

let failed = false;
const manifest = {};
const topicFiles = fs.readdirSync(TOPICS_DIR).filter((f) => f.endsWith('.json') && f !== 'manifest.json');

for (const file of topicFiles.sort()) {
  const topic = path.basename(file, '.json');
  const raw = fs.readFileSync(path.join(TOPICS_DIR, file), 'utf8');
  let data;
  try {
    data = JSON.parse(raw);
  } catch (err) {
    console.error(`❌ ${file}: invalid JSON — ${err.message}`);
    failed = true;
    continue;
  }

  const meta = LABELS[topic];
  if (!meta) {
    console.error(`❌ ${file}: no label/emoji entry in LABELS`);
    failed = true;
    continue;
  }

  const langs = {};
  let listOk = true;
  for (const lang of LANGS) {
    const list = data[lang];
    if (!Array.isArray(list)) {
      console.error(`❌ ${file}: missing language "${lang}"`);
      failed = true;
      listOk = false;
      continue;
    }
    if (list.length < 30) {
      console.error(`❌ ${file}[${lang}]: only ${list.length} words`);
      failed = true;
      listOk = false;
    }
    // shape + duplicate translations
    const seen = new Set();
    for (const pair of list) {
      if (!Array.isArray(pair) || pair.length !== 2 || typeof pair[0] !== 'string' || typeof pair[1] !== 'string') {
        console.error(`❌ ${file}[${lang}]: malformed pair ${JSON.stringify(pair)}`);
        failed = true;
        continue;
      }
      if (seen.has(pair[1])) {
        console.error(`❌ ${file}[${lang}]: duplicate translation "${pair[1]}"`);
        failed = true;
      }
      seen.add(pair[1]);
    }
    langs[lang] = list.length;
  }

  // cross-language: the English cores should be identical (same order/translations)
  const english = data[LANGS[0]]?.map((p) => p[1]);
  if (english) {
    for (const lang of LANGS.slice(1)) {
      const other = data[lang]?.map((p) => p[1]);
      if (other && JSON.stringify(other) !== JSON.stringify(english)) {
        console.error(`❌ ${file}: English core mismatch in "${lang}" — order/translations differ from "${LANGS[0]}"`);
        failed = true;
      }
    }
  }

  if (listOk) {
    console.log(`✅ ${file.padEnd(14)} ${Object.entries(langs).map(([l, n]) => `${l}:${n}`).join('  ')}`);
    manifest[topic] = { label: meta.label, emoji: meta.emoji, langs };
  }
}

if (failed) {
  console.error('\nValidation FAILED — manifest not rewritten.');
  process.exit(1);
}

fs.writeFileSync(
  path.join(TOPICS_DIR, 'manifest.json'),
  JSON.stringify(manifest, null, 2) + '\n',
);
const totals = Object.values(manifest).reduce(
  (a, t) => a + Object.values(t.langs).reduce((b, n) => b + n, 0),
  0,
);
console.log(`\n✅ All packs valid. Wrote manifest.json — ${Object.keys(manifest).length} topics, ${totals} word pairs total.`);
