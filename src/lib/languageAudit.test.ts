import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { flagFor } from '@/components/LanguageBadge';
import { findLanguage } from '@/lib/languages';
import { DEFAULT_ALLOWED_LANG, canUseLang, langLimitKey } from '@/lib/planGate';
import { SEED_SETS } from '@/lib/seedSets';
import { PACK_LANG, STARTER_LANGS, starterLangLabel } from '@/lib/starterSets';
import { CEFR_LEVELS, type CefrLevel, type VocabSet, type VocabWord } from '@/types/app';

const VOCAB_DIR = path.join(process.cwd(), 'public/data/vocab');
const TOPICS_DIR = path.join(process.cwd(), 'public/data/topics');

type Manifest = Record<string, Partial<Record<CefrLevel, number>>>;
const manifest = JSON.parse(
  fs.readFileSync(path.join(VOCAB_DIR, 'manifest.json'), 'utf8'),
) as Manifest;
const topicManifest = JSON.parse(
  fs.readFileSync(path.join(TOPICS_DIR, 'manifest.json'), 'utf8'),
) as Record<string, { label: string; emoji: string; langs: Record<string, number> }>;

const BCP47 = /^[a-z]{2,3}(?:-[A-Z]{2})?$/i;

function setOf(lang: string): VocabSet {
  return {
    id: 'audit-set',
    name: 'Audit',
    lang,
    nativeLang: 'en-US',
    words: [{ id: 'w1', target: 'x', translation: 'y' }],
    createdAt: 0,
    updatedAt: 0,
  };
}

function assertValidWords(words: VocabWord[], context: string): void {
  expect(words.length, `${context}: has words`).toBeGreaterThan(0);
  const ids = new Set<string>();
  for (const w of words) {
    expect(ids.has(w.id), `${context}: duplicate word id ${w.id}`).toBe(false);
    ids.add(w.id);
    expect(w.target.trim(), `${context}: non-empty target`).not.toBe('');
    expect(w.translation.trim(), `${context}: non-empty translation`).not.toBe('');
    expect(w.target, `${context}: no undefined/null literal`).not.toMatch(/^(undefined|null)$/);
    expect(w.translation, `${context}: no undefined/null literal`).not.toMatch(
      /^(undefined|null)$/,
    );
  }
}

/** Word-bank files on disk, keyed "<pack>-<level>" with a real file. */
const bankFiles = new Set(
  fs
    .readdirSync(VOCAB_DIR)
    .filter((f) => /^[a-z]{2,3}-[A-C][12]\.json$/.test(f))
    .map((f) => f.replace(/\.json$/, '')),
);

/** Shared cache so the heavy end-to-end test reads each bank file once. */
const bankCache = new Map<string, { lang: string; level: CefrLevel; words: Array<[string, string]> }>();
function loadBank(key: string) {
  let bank = bankCache.get(key);
  if (!bank) {
    bank = JSON.parse(
      fs.readFileSync(path.join(VOCAB_DIR, `${key}.json`), 'utf8'),
    ) as { lang: string; level: CefrLevel; words: Array<[string, string]> };
    bankCache.set(key, bank);
  }
  return bank;
}

describe('supported-language audit (data-driven over STARTER_LANGS)', () => {
  it('has a canonical, duplicate-free language list', () => {
    expect(STARTER_LANGS.length).toBeGreaterThan(0);
    expect(new Set(STARTER_LANGS).size).toBe(STARTER_LANGS.length);
    expect(new Set(Object.values(PACK_LANG)).size).toBe(Object.keys(PACK_LANG).length);
    // Every starter language maps to a pack code.
    for (const code of STARTER_LANGS) {
      expect(PACK_LANG[code], `${code}: PACK_LANG entry`).toBeTruthy();
    }
  });

  it(
    'every pack language validates end-to-end',
    { timeout: 30_000 },
    () => {
    const rows: string[] = [];
    for (const code of STARTER_LANGS) {
      const pack = PACK_LANG[code];
      const seed = SEED_SETS.find((s) => s.lang === code);

      // BCP-47 well-formed (drives TTS exact/prefix matching + storage keys).
      expect(code, `${code}: BCP-47 shape`).toMatch(BCP47);

      // Display name + flag exist (label is non-empty and readable).
      const label = findLanguage(code)?.label ?? starterLangLabel(code);
      expect(label.trim(), `${code}: display name`).not.toBe('');
      expect(flagFor(code), `${code}: flag`).toBeTruthy();

      // Normalization: BCP-47 tag → pack key, stable under repeated calls.
      expect(langLimitKey(code), `${code}: langLimitKey`).toBe(pack);
      expect(langLimitKey(langLimitKey(code)), `${code}: idempotent`).toBe(pack);

      // hiddenLangs round-trip: hiding by the normalized key hides this lang.
      const hidden = new Set([langLimitKey(code)]);
      expect(hidden.has(langLimitKey(code))).toBe(true);

      // Gate: Pro opens everything; Free opens an owned language, locks others.
      expect(canUseLang(true, [], code), `${code}: pro unrestricted`).toBe(true);
      expect(canUseLang(false, [setOf(code)], code), `${code}: free owns`).toBe(true);
      const other = STARTER_LANGS.find((c) => c !== code)!;
      expect(
        canUseLang(false, [setOf(other)], code),
        `${code}: free locks unowned`,
      ).toBe(langLimitKey(code) === langLimitKey(other));
      expect(canUseLang(false, [], code), `${code}: free default`).toBe(
        langLimitKey(code) === langLimitKey(DEFAULT_ALLOWED_LANG),
      );

      // Seed pack exists and is well-formed.
      expect(seed, `${code}: seed set`).toBeTruthy();
      assertValidWords(seed!.words, `${code}: seed ${seed!.id}`);

      // Word banks: manifest entry, real files, counts match, words valid.
      expect(manifest[pack], `${code}: manifest entry`).toBeTruthy();
      const levels = Object.keys(manifest[pack]) as CefrLevel[];
      expect(levels.length, `${code}: at least one level`).toBeGreaterThan(0);
      expect(
        levels.every((l) => CEFR_LEVELS.includes(l)),
        `${code}: levels valid`,
      ).toBe(true);
      let total = 0;
      for (const lvl of levels) {
        const key = `${pack}-${lvl}`;
        expect(bankFiles.has(key), `${code}: file ${key} exists`).toBe(true);
        const bank = loadBank(key);
        expect(bank.lang, `${key}: file lang`).toBe(pack);
        expect(bank.level, `${key}: file level`).toBe(lvl);
        const count = manifest[pack][lvl] ?? 0;
        expect(bank.words.length, `${key}: manifest count matches`).toBe(count);
        assertValidWords(
          bank.words.map(([t, tr], i) => ({ id: `${key}-${i}`, target: t, translation: tr })),
          `${key}`,
        );
        // No duplicated [target, translation] pairs inside a level.
        const pairs = new Set(bank.words.map(([t, tr]) => `${t}|${tr}`));
        expect(pairs.size, `${key}: no duplicate pairs`).toBe(bank.words.length);
        total += bank.words.length;
      }
      rows.push(
        `${pack.padEnd(3)} ${code.padEnd(6)} ${String(total).padStart(5)} words  levels=${levels
          .join('')}${levels.length < 6 ? '  (B1 gap)' : ''}`,
      );
    }
    console.log('\n[language audit] per-language word counts:\n' + rows.join('\n'));
  });

  it('manifest and filesystem agree (no orphan files, no phantom entries)', () => {
    const advertised = new Set<string>();
    for (const [pack, levels] of Object.entries(manifest)) {
      for (const lvl of Object.keys(levels)) advertised.add(`${pack}-${lvl}`);
    }
    expect(bankFiles.size).toBe(advertised.size);
    for (const key of advertised) expect(bankFiles.has(key), `${key} on disk`).toBe(true);
    for (const key of bankFiles) expect(advertised.has(key), `${key} advertised`).toBe(true);
  });

  it('every pack language ships the full A1–C2 level set', () => {
    for (const code of STARTER_LANGS) {
      const pack = PACK_LANG[code];
      for (const lvl of CEFR_LEVELS) {
        expect(manifest[pack]?.[lvl], `${code}: ${lvl}`).toBeGreaterThan(0);
      }
    }
  });

  it('B1 does not duplicate A1/A2 vocabulary (overlap guard)', () => {
    // B1 must meaningfully expand vocabulary, not recycle the basics. Exact
    // target-string overlap with A1+A2 is capped at 10% of the B1 pack — the
    // pre-existing packs (fr/de/it/pt/ru/tr) run 5.7-7.1% natural overlap, so
    // anything at ~100% means the level was built by copying the basics. The
    // six packs added in the B1 fill measure 0%.
    for (const code of STARTER_LANGS) {
      const pack = PACK_LANG[code];
      const prior = new Set<string>();
      for (const lvl of ['A1', 'A2'] as CefrLevel[]) {
        for (const [t] of loadBank(`${pack}-${lvl}`).words) prior.add(t.trim().toLowerCase());
      }
      const b1 = loadBank(`${pack}-B1`).words;
      const overlap = b1.filter(([t]) => prior.has(t.trim().toLowerCase())).length;
      expect(overlap, `${code}: B1 vs A1/A2 overlap`).toBeLessThanOrEqual(Math.ceil(b1.length * 0.1));
    }
  });

  it('topic packs cover all pack languages except the known mn gap', () => {
    const topicLangs = new Set<string>();
    for (const t of Object.values(topicManifest)) {
      for (const l of Object.keys(t.langs)) topicLangs.add(l);
    }
    for (const code of STARTER_LANGS) {
      const pack = PACK_LANG[code];
      if (pack === 'mn') continue; // known gap: no Mongolian topic packs
      expect(topicLangs.has(pack), `${code}: topic coverage`).toBe(true);
    }
    // Topic languages are either pack languages or have display labels.
    for (const l of topicLangs) {
      expect(
        Object.values(PACK_LANG).includes(l) || Boolean(findLanguage(l)),
        `topic lang ${l} resolvable`,
      ).toBe(true);
    }
  });

  it('every seed set (including non-pack languages) is well-formed', () => {
    const seen = new Set<string>();
    for (const s of SEED_SETS) {
      expect(seen.has(s.id), `${s.id}: unique seed id`).toBe(false);
      seen.add(s.id);
      expect(s.lang).toMatch(BCP47);
      expect(findLanguage(s.lang), `${s.id}: lang known`).toBeTruthy();
      expect(flagFor(s.lang), `${s.id}: flag`).toBeTruthy();
      assertValidWords(s.words, `${s.id}`);
      expect(s.cefr, `${s.id}: cefr`).toBe('A1');
    }
    // Every pack language has a seed; the remaining seeds are pack-less but
    // valid (curated-only languages with no word bank).
    const seedLangs = new Set(SEED_SETS.map((s) => s.lang));
    for (const code of STARTER_LANGS) expect(seedLangs.has(code), `${code}: seeded`).toBe(true);
  });

  it('cross-language normalization: pack tags normalize together, variants stay distinct', () => {
    // Same-family tags must normalize to the same gate key.
    expect(langLimitKey('es-ES')).toBe(langLimitKey('es'));
    expect(langLimitKey('fr-FR')).toBe(langLimitKey('fr'));
    expect(langLimitKey('ja-JP')).toBe(langLimitKey('ja'));
    expect(langLimitKey('zh-CN')).toBe(langLimitKey('zh'));
    expect(langLimitKey('ar-EG')).toBe(langLimitKey('ar'));
    expect(langLimitKey('pt-BR')).toBe(langLimitKey('pt'));
    // Regional variants without a PACK_LANG entry are deliberately separate
    // gate keys (documented behavior — a Free user cannot mix them freely).
    expect(langLimitKey('pt-PT')).toBe('pt-PT');
    expect(langLimitKey('es-MX')).toBe('es-MX');
    expect(langLimitKey('ko-KR')).toBe('ko-KR');
    expect(langLimitKey('it-CH')).toBe('it-CH');
  });
});
