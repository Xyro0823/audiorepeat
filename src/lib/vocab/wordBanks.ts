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

/**
 * Topic packs (public/data/topics/<topic>.json): one file per topic holding
 * word lists for several languages — { "es": [["avión","airplane"], ...], ... }.
 * The manifest advertises labels/emojis and per-language counts.
 */
export interface TopicManifestEntry {
  label: string;
  emoji: string;
  langs: Record<string, number>;
}

export type TopicManifest = Record<string, TopicManifestEntry>;

export interface TopicBank {
  topic: string;
  lang: string;
  words: WordBankWord[];
}

const MANIFEST_URL = '/data/vocab/manifest.json';
const TOPIC_MANIFEST_URL = '/data/topics/manifest.json';

let manifestPromise: Promise<WordBankManifest> | null = null;
let topicManifestPromise: Promise<TopicManifest> | null = null;
const bankCache = new Map<string, Promise<WordBank | null>>();
const topicCache = new Map<string, Promise<Record<string, WordBankWord[]> | null>>();

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

export function getTopicManifest(): Promise<TopicManifest> {
  if (!topicManifestPromise) {
    topicManifestPromise = fetch(TOPIC_MANIFEST_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`topic manifest ${res.status}`);
        return res.json() as Promise<TopicManifest>;
      })
      .catch((err) => {
        topicManifestPromise = null; // allow retry on next call
        throw err;
      });
  }
  return topicManifestPromise;
}

/** Load one topic file (all languages). Returns null when no file exists. */
export function loadTopic(topic: string): Promise<Record<string, WordBankWord[]> | null> {
  let p = topicCache.get(topic);
  if (!p) {
    p = fetch(`/data/topics/${topic}.json`)
      .then((res) => {
        if (res.status === 404) return null;
        if (!res.ok) throw new Error(`topic ${res.status}`);
        return res.json() as Promise<Record<string, WordBankWord[]>>;
      })
      .catch((err) => {
        topicCache.delete(topic);
        throw err;
      });
    topicCache.set(topic, p);
  }
  return p;
}

