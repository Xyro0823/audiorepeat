import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

type CanonicalBank = { lang: string; level: string; words: unknown[] };
type MongolianBank = { lang: string; level: string; sourceLanguage: string; translations: unknown[] };

describe('offline Mongolian explanations for bundled vocabulary', () => {
  it('keeps every non-Mongolian static bank index-aligned with a Mongolian companion', () => {
    const dir = path.join(process.cwd(), 'public/data/vocab');
    for (const file of fs.readdirSync(dir).filter((entry) => /^[a-z]{2,3}-[ABC][12]\.json$/.test(entry))) {
      const canonical = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8')) as CanonicalBank;
      if (canonical.lang === 'mn') continue;
      const translated = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'public/data/vocab-mn', file), 'utf8')) as MongolianBank;
      expect(translated.lang).toBe(canonical.lang);
      expect(translated.level).toBe(canonical.level);
      expect(translated.sourceLanguage).toBe('en');
      expect(translated.translations).toHaveLength(canonical.words.length);
      expect(translated.translations.every((text) => typeof text === 'string' && text.trim().length > 0)).toBe(true);
    }
  });
});
