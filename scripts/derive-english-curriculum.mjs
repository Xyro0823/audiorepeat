/**
 * Derive the English-for-Mongolians A1–C2 curriculum from the maintained
 * Mongolian-for-English curriculum. Each pair is reversed so learners hear
 * English and see the Mongolian meaning. No external service is used.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const vocabDir = join(process.cwd(), 'public', 'data', 'vocab');
const levels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

for (const level of levels) {
  const source = JSON.parse(readFileSync(join(vocabDir, `mn-${level}.json`), 'utf8'));
  const words = source.words.map(([mongolian, english]) => [english, mongolian]);
  writeFileSync(
    join(vocabDir, `en-${level}.json`),
    JSON.stringify({ lang: 'en', level, words }, null, 2) + '\n',
  );
  console.log(`en-${level}: ${words.length} English → Mongolian pairs`);
}
