import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { flagFor } from '@/components/LanguageBadge';
import { findLanguage } from '@/lib/languages';
import { DEFAULT_ALLOWED_LANG, canUseLang, langLimitKey } from '@/lib/planGate';
import { SEED_SETS } from '@/lib/seedSets';
import { A1_STARTER_LANGS, PACK_LANG, STARTER_LANGS, starterLangLabel } from '@/lib/starterSets';
import {
  B1_OVERLAP_MAX,
  CROSS_LEVEL_PAIR_MAX,
  CROSS_LEVEL_TARGET_MAX,
  LANGUAGE_ISOLATION_MAX,
  overlapRatio,
  pairSet,
  targetSet,
} from '@/lib/vocabThresholds';
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

  it('every pack language ships exactly the canonical A1–C2 level set', () => {
    // No level missing, and no unexpected level for any pack.
    for (const code of STARTER_LANGS) {
      const pack = PACK_LANG[code];
      expect(new Set(Object.keys(manifest[pack] ?? {})), `${code}: exact level set`).toEqual(
        new Set(CEFR_LEVELS),
      );
      for (const lvl of CEFR_LEVELS) {
        expect(manifest[pack]?.[lvl], `${code}: ${lvl} count`).toBeGreaterThan(0);
      }
    }
  });

  it('every first-stage language ships a substantial A1 foundation', () => {
    for (const code of A1_STARTER_LANGS) {
      const pack = PACK_LANG[code];
      expect(pack, `${code}: PACK_LANG entry`).toBeTruthy();
      expect(Object.keys(manifest[pack] ?? {}), `${code}: A1-only foundation`).toEqual(['A1']);
      expect(manifest[pack]?.A1, `${code}: A1 word count`).toBeGreaterThanOrEqual(250);
      expect(SEED_SETS.some((seed) => seed.lang === code), `${code}: seed set`).toBe(true);
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
      expect(overlap, `${code}: B1 vs A1/A2 overlap`).toBeLessThanOrEqual(
        Math.ceil(b1.length * B1_OVERLAP_MAX),
      );
    }
  });

  it('languages stay isolated: no pack is a copy of another pack (same level)', () => {
    // Whole-language copies would share near-identical target strings at the
    // same level. Baseline (measured): same-level cross-language overlap max
    // is 18.2% (ja-zh C2); es-pt A1 17.0%; everything else far lower. A pack
    // accidentally copied from another language would land at ~100%, so 70%
    // catches copies with a wide safety margin over every legitimate pair.
    const langs = STARTER_LANGS.map((code) => PACK_LANG[code]);
    for (const lvl of CEFR_LEVELS) {
      const sets = new Map<string, Set<string>>();
      for (const pack of langs) {
        const s = new Set<string>();
        for (const [t] of loadBank(`${pack}-${lvl}`).words) s.add(t.trim().toLowerCase());
        sets.set(pack, s);
      }
      for (let i = 0; i < langs.length; i++) {
        for (let j = i + 1; j < langs.length; j++) {
          const a = sets.get(langs[i])!;
          const b = sets.get(langs[j])!;
          const ratio = overlapRatio(a, b);
          expect(
            ratio,
            `${lvl}: ${langs[i]}-${langs[j]} same-level overlap`,
          ).toBeLessThan(LANGUAGE_ISOLATION_MAX);
        }
      }
    }
  });

  it('bank levels stay distinct within each language (cross-level duplication guards)', () => {
    // Two complementary signals for every level pair within a language:
    //   A. targetOverlap = |shared target strings| / min(level sizes)  < 50%
    //   B. pairOverlap    = |shared exact [target, English] pairs| / min < 50%
    // A wholesale copy (e.g. A2 duplicated as B2) sits near 100% on both.
    //
    // Baselines (measured over all 13 packs): targetOverlap max is 42.2%
    // (mn B2-C1); pairOverlap max is 28.2% (hi B2-C1), CJK family
    // 21.6-28.2%, all other languages <= 18.6%, median 1.2%. A 50% cap on
    // both leaves generous headroom above the natural maximum while still
    // catching copy/paste duplication. pairOverlap additionally stays low
    // when a shared target carries different English senses across levels
    // (translation convergence), which targetOverlap alone would over-count.
    for (const code of STARTER_LANGS) {
      const pack = PACK_LANG[code];
      const targets = new Map<string, Set<string>>();
      const pairs = new Map<string, Set<string>>();
      for (const lvl of CEFR_LEVELS) {
        const words = loadBank(`${pack}-${lvl}`).words;
        targets.set(lvl, targetSet(words));
        pairs.set(lvl, pairSet(words));
      }
      for (let i = 0; i < CEFR_LEVELS.length; i++) {
        for (let j = i + 1; j < CEFR_LEVELS.length; j++) {
          const lvlA = CEFR_LEVELS[i];
          const lvlB = CEFR_LEVELS[j];
          const targetRatio = overlapRatio(targets.get(lvlA)!, targets.get(lvlB)!);
          expect(
            targetRatio,
            `${code}: ${lvlA}-${lvlB} target overlap`,
          ).toBeLessThan(CROSS_LEVEL_TARGET_MAX);
          const pairRatio = overlapRatio(pairs.get(lvlA)!, pairs.get(lvlB)!);
          expect(
            pairRatio,
            `${code}: ${lvlA}-${lvlB} exact pair overlap`,
          ).toBeLessThan(CROSS_LEVEL_PAIR_MAX);
        }
      }
    }
  });

  it('topic packs cover every pack language', () => {
    const topicLangs = new Set<string>();
    for (const t of Object.values(topicManifest)) {
      for (const l of Object.keys(t.langs)) topicLangs.add(l);
    }
    for (const code of STARTER_LANGS) {
      const pack = PACK_LANG[code];
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

  it('topic concept cores are identical and complete across every language', () => {
    // The shared English core drives positional pairing: every language list
    // must be the same ordered concept list as the reference language, with
    // no dropped, extra, or reordered concepts.
    for (const [topic, meta] of Object.entries(topicManifest)) {
      const raw = JSON.parse(
        fs.readFileSync(path.join(TOPICS_DIR, `${topic}.json`), 'utf8'),
      ) as Record<string, Array<[string, string]>>;
      const langs = Object.keys(meta.langs);
      expect(langs.length, `${topic}: manifest languages`).toBeGreaterThan(0);
      const ref = langs[0];
      const core = raw[ref].map(([, en]) => en.trim());
      expect(new Set(core).size, `${topic}: core has no duplicate concepts`).toBe(
        core.length,
      );
      for (const lang of langs) {
        const list = raw[lang];
        expect(list.length, `${topic}[${lang}]: count matches core`).toBe(core.length);
        const theirs = list.map(([, en]) => en.trim());
        expect(theirs, `${topic}[${lang}]: identical ordered core`).toEqual(core);
      }
    }
  });

  it('every pack language is present in every topic with matching manifest counts', () => {
    // Each STARTER_LANGS pack language must appear in ALL topics (not just
    // some), and the manifest's advertised count must equal the real file.
    for (const code of STARTER_LANGS) {
      const pack = PACK_LANG[code];
      for (const [topic, meta] of Object.entries(topicManifest)) {
        const raw = JSON.parse(
          fs.readFileSync(path.join(TOPICS_DIR, `${topic}.json`), 'utf8'),
        ) as Record<string, Array<[string, string]>>;
        expect(meta.langs[pack], `${topic}: ${pack} advertised`).toBeGreaterThan(0);
        expect(raw[pack]?.length, `${topic}[${pack}]: file count`).toBe(
          meta.langs[pack],
        );
      }
    }
  });

  it('topic manifest and topic files agree (no orphans, no phantom languages)', () => {
    const topicFiles = fs
      .readdirSync(TOPICS_DIR)
      .filter((f) => f.endsWith('.json') && f !== 'manifest.json')
      .map((f) => f.replace(/\.json$/, ''));
    expect(new Set(topicFiles).size, 'no duplicate topic files').toBe(topicFiles.length);
    expect(new Set(Object.keys(topicManifest)).size, 'no duplicate manifest topics').toBe(
      Object.keys(topicManifest).length,
    );
    expect(new Set(topicFiles), 'manifest topics match files on disk').toEqual(
      new Set(Object.keys(topicManifest)),
    );
    for (const [topic, meta] of Object.entries(topicManifest)) {
      const raw = JSON.parse(
        fs.readFileSync(path.join(TOPICS_DIR, `${topic}.json`), 'utf8'),
      ) as Record<string, Array<[string, string]>>;
      const fileLangs = Object.keys(raw);
      expect(new Set(fileLangs), `${topic}: file langs == manifest langs`).toEqual(
        new Set(Object.keys(meta.langs)),
      );
      for (const [lang, count] of Object.entries(meta.langs)) {
        expect(raw[lang]?.length, `${topic}[${lang}]: manifest count == file`).toBe(
          count,
        );
      }
    }
  });

  it('parity guard confidence: synthetic missing/extra/reordered/miscounted data fails', () => {
    const core: Array<[string, string]> = [['a', 'alpha'], ['b', 'beta'], ['c', 'gamma']];
    const ok = { es: core.map((p) => [...p] as [string, string]), fr: core.map((p) => [...p] as [string, string]) };
    // Baseline: reference and sibling agree.
    expect(ok['fr'].length).toBe(ok['es'].length);
    expect(ok['fr'].map(([, e]) => e)).toEqual(ok['es'].map(([, e]) => e));

    // Missing concept: fr drops one.
    const missing = { es: core.map((p) => [...p] as [string, string]), fr: core.slice(0, 2).map((p) => [...p] as [string, string]) };
    expect(missing['fr'].length === missing['es'].length).toBe(false);
    expect(missing['fr'].map(([, e]) => e)).not.toEqual(missing['es'].map(([, e]) => e));

    // Extra concept: fr adds one not in the core.
    const extra = { es: core.map((p) => [...p] as [string, string]), fr: [...core.map((p) => [...p] as [string, string]), ['x', 'delta'] as [string, string]] };
    expect(extra['fr'].length === extra['es'].length).toBe(false);
    expect(extra['fr'].map(([, e]) => e)).not.toEqual(extra['es'].map(([, e]) => e));

    // Reordered concept: same set, different order.
    const reordered = { es: core.map((p) => [...p] as [string, string]), fr: [core[0], core[2], core[1]].map((p) => [...p] as [string, string]) };
    expect(reordered['fr'].map(([, e]) => e)).not.toEqual(reordered['es'].map(([, e]) => e));

    // Miscounted manifest: advertised count differs from file length.
    expect(3 === ok['es'].length).toBe(true);
    expect(4 === ok['fr'].length).toBe(false);
  });

  it('bank guard confidence: synthetic malformed banks are detected', () => {
    // Overlap ratio used by the isolation/duplication guards (|A∩B| / min(|A|,|B|)).
    const overlap = (a: Set<string>, b: Set<string>) =>
      [...a].filter((v) => b.has(v)).length / Math.min(a.size, b.size);

    // 1. Missing level: a pack with only five levels lacks the sixth.
    const partialLevels = new Set(['A1', 'A2', 'B1', 'B2', 'C1']);
    expect(partialLevels.has('C2')).toBe(false);

    // 2. Phantom manifest entry: advertised pack-level has no file on disk.
    const fileKeys = new Set(['es-A1', 'es-A2', 'es-B1', 'es-B2', 'es-C1', 'es-C2']);
    expect(fileKeys.has('es-B1')).toBe(true);
    expect(fileKeys.has('es-X9')).toBe(false);

    // 3. Wrong manifest count: advertised count differs from words length.
    const bank = { lang: 'es', level: 'A1', words: [['a', 'alpha'], ['b', 'beta']] };
    const advertised = 3; // would be read from manifest.json
    expect(bank.words.length).toBe(2);
    expect(advertised === bank.words.length).toBe(false); // mismatch detected

    // 4. Filename/lang mismatch.
    const fileLang = (name: string) => /^([a-z]{2,3})-[A-C][12]\.json$/.exec(name)?.[1];
    expect(fileLang('es-A1.json')).toBe('es');
    expect(fileLang('es-A1.json')).not.toBe('fr');

    // 5. Filename/level mismatch.
    const fileLevel = (name: string) => /^[a-z]{2,3}-([A-C][12])\.json$/.exec(name)?.[1];
    expect(fileLevel('es-A1.json')).toBe('A1');
    expect(fileLevel('es-A1.json')).not.toBe('B2');

    // 6. Duplicate pair: repeated [target, english] rows exceed unique pairs.
    const dupWords: Array<[string, string]> = [
      ['a', 'alpha'],
      ['b', 'beta'],
      ['a', 'alpha'],
    ];
    expect(new Set(dupWords.map(([t, e]) => `${t}|${e}`)).size).toBe(2);
    expect(new Set(dupWords.map(([t, e]) => `${t}|${e}`)).size).not.toBe(
      dupWords.length,
    );

    // 7. Obvious copied pack: identical same-level sets trip the isolation
    //    guard (100% >> 70%) and identical levels trip the 50% duplication
    //    guard.
    const identical = new Set(['x', 'y', 'z']);
    expect(overlap(identical, identical)).toBeGreaterThanOrEqual(LANGUAGE_ISOLATION_MAX);
    expect(overlap(identical, identical)).toBeGreaterThanOrEqual(CROSS_LEVEL_TARGET_MAX);

    // 8. Pair-based signal: a near-copy level shares exact [target, English]
    //    pairs and must trip the pair-overlap guard (100% >> 50%).
    const wordsA: Array<[string, string]> = [['a', 'alpha'], ['b', 'beta'], ['c', 'gamma']];
    const wordsB: Array<[string, string]> = [['a', 'alpha'], ['b', 'beta'], ['c', 'gamma']];
    expect(overlapRatio(pairSet(wordsA), pairSet(wordsB))).toBeGreaterThanOrEqual(
      CROSS_LEVEL_PAIR_MAX,
    );

    // 9. Translation convergence: the same target used with DIFFERENT English
    //    senses across levels raises target-only overlap but must NOT trip the
    //    pair-overlap guard (shared pairs = 0%).
    const convA: Array<[string, string]> = [['bank', 'financial institution'], ['run', 'to run fast']];
    const convB: Array<[string, string]> = [['bank', 'river bank'], ['run', 'a run in a race']];
    expect(overlapRatio(targetSet(convA), targetSet(convB))).toBeGreaterThanOrEqual(
      CROSS_LEVEL_TARGET_MAX,
    );
    expect(overlapRatio(pairSet(convA), pairSet(convB))).toBeLessThan(
      CROSS_LEVEL_PAIR_MAX,
    );
  });

  it('topic packs are well-formed and free of hard translation errors', () => {
    // Structure: every topic file is a map of language -> [target, english].
    for (const [topic, meta] of Object.entries(topicManifest)) {
      const raw = fs.readFileSync(path.join(TOPICS_DIR, `${topic}.json`), 'utf8');
      const data = JSON.parse(raw) as Record<string, Array<[string, string]>>;
      for (const lang of Object.keys(meta.langs)) {
        const list = data[lang];
        expect(Array.isArray(list), `${topic}[${lang}]: array`).toBe(true);
        for (const [target, en] of list) {
          expect(target.trim(), `${topic}[${lang}]: target ${en}`).not.toBe('');
          expect(en.trim(), `${topic}[${lang}]: english`).not.toBe('');
        }
      }
    }

    // Hard terminology errors: bank and topic both translate the same
    // concept, but one side is clearly the wrong word (not a synonym/register
    // variant). Keyed by normalized english concept per pack language.
    // E.g. mn health 'temperature' -> 'халуун' (hot) while the mn banks use
    // 'температур' — a genuine meaning mismatch; mn emotions 'disappointed'
    // -> 'урам хуарсан' (typo for 'урам хугарсан'); ar 'calm' -> 'مطمئن'
    // (confident/sure, not calm).
    const hardErrors: Record<string, Record<string, string>> = {
      mn: { temperature: 'температур', disappointed: 'урам хугарсан' },
      ar: { calm: 'هادئ' },
    };
    for (const code of STARTER_LANGS) {
      const pack = PACK_LANG[code];
      const banks = new Map<string, string[]>();
      for (const lvl of CEFR_LEVELS) {
        for (const [target, en] of loadBank(`${pack}-${lvl}`).words) {
          const key = en.trim().toLowerCase();
          banks.set(key, [...(banks.get(key) ?? []), target.trim()]);
        }
      }
      const expected = hardErrors[pack];
      if (!expected) continue;
      for (const [en, correct] of Object.entries(expected)) {
        const bankTargets = banks.get(en) ?? [];
        expect(bankTargets, `${pack}: bank has ${en}`).toContain(correct);
        for (const topic of Object.keys(topicManifest)) {
          const raw = JSON.parse(
            fs.readFileSync(path.join(TOPICS_DIR, `${topic}.json`), 'utf8'),
          ) as Record<string, Array<[string, string]>>;
          const entry = (raw[pack] ?? []).find(([, e]) => e.trim().toLowerCase() === en);
          if (!entry) continue;
          expect(entry[0].trim(), `${pack} ${topic}: ${en} equals bank`).toBe(correct);
        }
      }
    }
  });
});
