import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const languages = ['cs', 'da', 'el', 'fa', 'fi', 'fil', 'he', 'id', 'nb', 'nl', 'pl', 'sv', 'sw', 'th', 'uk', 'vi'];

describe('offline Mongolian explanations for Tatoeba A1', () => {
  it('keeps each explanation list aligned with its 250 canonical pairs', () => {
    for (const lang of languages) {
      const source = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'public/data/vocab', `${lang}-A1.json`), 'utf8')) as {
        words: unknown[];
      };
      const translated = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'public/data/vocab-mn', `${lang}-A1.json`), 'utf8')) as {
        lang: string;
        level: string;
        translations: unknown[];
      };
      expect(translated.lang).toBe(lang);
      expect(translated.level).toBe('A1');
      expect(translated.translations).toHaveLength(source.words.length);
      expect(translated.translations).toHaveLength(250);
      expect(translated.translations.every((text) => typeof text === 'string' && text.trim().length > 0)).toBe(true);
    }
  });
});
