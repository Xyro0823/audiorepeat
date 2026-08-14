import type { CefrLevel } from '@/types/app';
import { findLanguage } from '@/lib/languages';

/**
 * CEFR-leveled starter vocabulary library.
 *
 * Thirteen pack languages (STARTER_LANGS) ship a full A1–C2 word pack stored
 * as static JSON under /data/vocab/<pack-lang>-<level>.json (see
 * src/lib/vocab/wordBanks.ts). Counts are comprehensive per level — A1/A2
 * ~250-300 words, B1/B2 ~280-550, C1/C2 ~300-2,500 — so an imported starter
 * level is a real study deck, not a handful of demo words. This file only maps
 * BCP-47 tags (used by the player) to pack codes (used by the manifest) and
 * carries display metadata.
 */

export const CEFR_META: Record<
  CefrLevel,
  { label: string; description: string; badge: string; chip: string }
> = {
  A1: {
    label: 'Beginner',
    description: 'Everyday greetings, numbers, essential nouns & verbs',
    badge: 'border-neon-green/40 bg-neon-green/10 text-neon-green',
    chip: 'border-neon-green/60 bg-neon-green/20 text-neon-green',
  },
  A2: {
    label: 'Elementary',
    description: 'Basic conversations, travel, shopping, directions',
    badge: 'border-neon-green/40 bg-neon-green/10 text-neon-green',
    chip: 'border-neon-green/60 bg-neon-green/20 text-neon-green',
  },
  B1: {
    label: 'Intermediate',
    description: 'Intermediate topics, work, opinions, expressions',
    badge: 'border-neon-cyan/40 bg-neon-cyan/10 text-neon-cyan',
    chip: 'border-neon-cyan/60 bg-neon-cyan/20 text-neon-cyan',
  },
  B2: {
    label: 'Upper-intermediate',
    description: 'Advanced discussions, abstract concepts, formal phrases',
    badge: 'border-neon-cyan/40 bg-neon-cyan/10 text-neon-cyan',
    chip: 'border-neon-cyan/60 bg-neon-cyan/20 text-neon-cyan',
  },
  C1: {
    label: 'Advanced',
    description: 'Mastery vocabulary, idiomatic expressions, connectors',
    badge: 'border-neon-violet/50 bg-neon-violet/10 text-neon-violet',
    chip: 'border-neon-violet/60 bg-neon-violet/20 text-neon-violet',
  },
  C2: {
    label: 'Proficiency',
    description: 'Mastery vocabulary, idioms, technical & academic words',
    badge: 'border-neon-amber/40 bg-neon-amber/10 text-neon-amber',
    chip: 'border-neon-amber/60 bg-neon-amber/20 text-neon-amber',
  },
};

/**
 * Language BCP-47 codes that ship starter word packs (in display order).
 * `code` is the tag used for sets/player; the corresponding pack code is the
 * manifest key / JSON filename prefix (see PACK_LANG).
 */
export const STARTER_LANGS = [
  'es-ES',
  'fr-FR',
  'de-DE',
  'it',
  'pt-BR',
  'ja-JP',
  'ko',
  'zh-CN',
  'ru',
  'ar-EG',
  'hi',
  'tr',
  'mn',
] as const;

/** BCP-47 tag → word-pack code (2-letter manifest key / JSON prefix). */
export const PACK_LANG: Record<string, string> = {
  'es-ES': 'es',
  'fr-FR': 'fr',
  'de-DE': 'de',
  it: 'it',
  'pt-BR': 'pt',
  'ja-JP': 'ja',
  ko: 'ko',
  'zh-CN': 'zh',
  ru: 'ru',
  'ar-EG': 'ar',
  hi: 'hi',
  tr: 'tr',
  mn: 'mn',
};

/** Pack code (e.g. "es") → display label (e.g. "Spanish (Spain)"). */
export function starterLangLabel(lang: string): string {
  return findLanguage(lang)?.label ?? lang;
}

/**
 * Reverse PACK_LANG: 2-letter pack code → friendly label, e.g. "fr" →
 * "French (France)". Needed for topic packs, whose languages are pack codes.
 */
export function packLangLabel(pack: string): string {
  const bcp = STARTER_LANGS.find((code) => PACK_LANG[code] === pack);
  return bcp ? starterLangLabel(bcp) : (findLanguage(pack)?.label ?? pack);
}
