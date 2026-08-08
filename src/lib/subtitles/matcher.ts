/**
 * Offline translation matching for extracted subtitle keywords.
 *
 * Uses the bundled CEFR word banks (A1→B1) as a mini dictionary: when the
 * chosen subtitle language has a pack, each keyword is looked up (normalized)
 * and its bank translation reused. Keywords with no match keep the caller's
 * placeholder so the user can fill them in the set editor.
 */
import { loadWordBank } from '@/lib/vocab/wordBanks';
import { PACK_LANG } from '@/lib/starterSets';
import type { CefrLevel } from '@/types/app';
import { foldToken } from './parser';

const LOOKUP_LEVELS: CefrLevel[] = ['A1', 'A2', 'B1'];

const bankCache = new Map<string, Map<string, string> | null>();

async function bankLookup(pack: string, level: CefrLevel): Promise<Map<string, string> | null> {
  const key = `${pack}:${level}`;
  const cached = bankCache.get(key);
  if (cached !== undefined) return cached;
  try {
    const bank = await loadWordBank(pack, level);
    const map = new Map<string, string>();
    if (bank) {
      for (const [target, translation] of bank.words) {
        map.set(foldToken(target), translation);
      }
    }
    const result = map.size > 0 ? map : null;
    bankCache.set(key, result);
    return result;
  } catch {
    bankCache.set(key, null);
    return null;
  }
}

/**
 * Returns a map of keyword → English translation. Keywords that couldn't be
 * matched are simply absent (the caller applies its placeholder).
 */
export async function translateKeywords(
  bcpLang: string,
  keywords: string[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const pack = PACK_LANG[bcpLang];
  if (!pack) return out; // no bundled dictionary for this language
  const maps: Array<Map<string, string> | null> = [];
  for (const level of LOOKUP_LEVELS) maps.push(await bankLookup(pack, level));
  for (const kw of keywords) {
    const fold = foldToken(kw);
    for (const map of maps) {
      const translation = map?.get(fold);
      if (translation) {
        out.set(kw, translation);
        break;
      }
    }
  }
  return out;
}
