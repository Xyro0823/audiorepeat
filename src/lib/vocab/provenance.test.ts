import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

type Source = {
  id: string;
  name: string;
  license: string;
  licenseUrl: string;
  sourceUrl: string;
  attribution: string;
  importStatus: 'approved' | 'review-required' | 'blocked';
  use: string;
};

const sourcesPath = path.join(process.cwd(), 'public/data/vocab-provenance/sources.json');
const sources = JSON.parse(fs.readFileSync(sourcesPath, 'utf8')) as { sources: Source[] };
const tatoebaImportPath = path.join(process.cwd(), 'public/data/vocab-provenance/tatoeba-a1.json');

describe('vocabulary source provenance', () => {
  it('gives every source a unique identity and a concrete usage boundary', () => {
    expect(sources.sources.length).toBeGreaterThan(0);
    expect(new Set(sources.sources.map((source) => source.id)).size).toBe(sources.sources.length);
    for (const source of sources.sources) {
      expect(source.name.trim()).not.toBe('');
      expect(source.license.trim()).not.toBe('');
      expect(source.use.trim()).not.toBe('');
    }
  });

  it('requires a license, source link, and attribution before an import is approved', () => {
    for (const source of sources.sources.filter((entry) => entry.importStatus === 'approved')) {
      expect(source.licenseUrl, `${source.id}: license link`).toMatch(/^https:\/\//);
      expect(source.sourceUrl, `${source.id}: source link`).toMatch(/^https:\/\//);
      expect(source.attribution, `${source.id}: attribution`).not.toBe('');
    }
  });

  it('never treats publisher-owned lists as importable source data', () => {
    const publisherLists = sources.sources.find((source) => source.id === 'publisher-lists');
    expect(publisherLists?.importStatus).toBe('blocked');
  });

  it('records the source and coverage of the generated Tatoeba A1 banks', () => {
    const importRecord = JSON.parse(fs.readFileSync(tatoebaImportPath, 'utf8')) as {
      sourceId: string;
      license: string;
      generatedBanks: Array<{ lang: string; level: string; pairs: number }>;
    };
    expect(importRecord.sourceId).toBe('tatoeba');
    expect(importRecord.license).toBe('CC BY 2.0 FR');
    expect(importRecord.generatedBanks).toHaveLength(16);
    for (const bank of importRecord.generatedBanks) {
      expect(bank.level).toBe('A1');
      expect(bank.pairs).toBe(250);
    }
  });
});
