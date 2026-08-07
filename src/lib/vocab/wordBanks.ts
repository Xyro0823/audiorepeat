import type { CefrLevel } from '@/types/app';

/**
 * Large vocabulary "word banks": 1,000+ word datasets per language, split by
 * CEFR level and stored as static JSON under /data/vocab/. Files are fetched
 * lazily per language+level (never bundled), kept in a module-level cache, and
 * cached by the service worker so they work offline after first load.
 *
 * File format (public/data/vocab/<lang>-<level>.json):
 *   { "lang": "es", "level": "A1", "words": [["hola","hello"], ...] }
 * The manifest (public/data/vocab/manifest.json) advertises availability:
 *   { "es": { "A1": 120, "A2": 180, ... }, "mn": { "A1": 100 } }
 */

/** Compact [target, translation] pair. */
export type WordBankWord = [target: string, translation: string];

export type WordBankManifest = Record<string, Partial<Record<CefrLevel, number>>>;

export interface WordBank {
  lang: string;
  level: CefrLevel;
  words: WordBankWord[];
}

const MANIFEST_URL = '/data/vocab/manifest.json';

let manifestPromise: Promise<WordBankManifest> | null = null;
const bankCache = new Map<string, Promise<WordBank | null>>();

export function getWordBankManifest(): Promise<WordBankManifest> {
  if (!manifestPromise) {
    manifestPromise = fetch(MANIFEST_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`manifest ${res.status}`);
        return res.json() as Promise<WordBankManifest>;
      })
      .catch((err) => {
        manifestPromise = null; // allow retry on next call
        throw err;
      });
  }
  return manifestPromise;
}

function bankUrl(lang: string, level: CefrLevel): string {
  return `/data/vocab/${lang}-${level}.json`;
}

/** Load one language+level bank. Returns null when no file exists. */
export function loadWordBank(lang: string, level: CefrLevel): Promise<WordBank | null> {
  const key = `${lang}:${level}`;
  let p = bankCache.get(key);
  if (!p) {
    p = fetch(bankUrl(lang, level))
      .then((res) => {
        if (res.status === 404) return null;
        if (!res.ok) throw new Error(`bank ${res.status}`);
        return res.json() as Promise<WordBank>;
      })
      .catch((err) => {
        bankCache.delete(key);
        throw err;
      });
    bankCache.set(key, p);
  }
  return p;
}

