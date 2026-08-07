'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { AppSettings, VocabSet, VocabWord } from '@/types/app';
import { DEFAULT_SETTINGS } from '@/types/app';
import { SEED_SETS } from '@/lib/seedSets';
import { PACK_LANG } from '@/lib/starterSets';
import { loadWordBank } from '@/lib/vocab/wordBanks';
import {
  deleteSet as dbDeleteSet,
  getAllSets,
  getSettings,
  putSet,
  putSettings,
} from '@/lib/db/indexedDb';

// Bump this whenever new starter sets are added, so existing installs receive
// them exactly once (a user who deletes a seed set keeps it deleted).
const SEED_VERSION = 6;
const SEED_VERSION_KEY = 'audiorepeat-seed-version';

// Word ids of the original 5-word starter sets, used to detect copies the user
// has never edited so they can be refreshed with the expanded vocabulary.
const ORIGINAL_SEED_WORD_IDS: Record<string, string[]> = {
  'seed-spanish-essentials': ['w-hola', 'w-gracias', 'w-por-favor', 'w-lo-siento', 'w-adios'],
  'seed-french-basics': ['w-bonjour', 'w-merci', 'w-oui', 'w-non', 'w-ou-est'],
  'seed-german-phrases': ['w-hallo', 'w-danke', 'w-bitte', 'w-entschuldigung', 'w-wo-ist'],
  'seed-japanese-greetings': ['w-konnichiwa', 'w-arigatou', 'w-sumimasen', 'w-hai', 'w-ie'],
  'seed-portuguese-basics': ['w-pt-ola', 'w-pt-obrigado', 'w-pt-por-favor', 'w-pt-sim', 'w-pt-adeus'],
  'seed-italian-essentials': ['w-it-ciao', 'w-it-grazie', 'w-it-per-favore', 'w-it-si', 'w-it-arrivederci'],
  'seed-russian-basics': ['w-ru-privet', 'w-ru-spasibo', 'w-ru-pozhaluysta', 'w-ru-da', 'w-ru-do-svidaniya'],
  'seed-chinese-basics': ['w-zh-nihao', 'w-zh-xiexie', 'w-zh-qing', 'w-zh-shi', 'w-zh-zaijian'],
  'seed-korean-essentials': ['w-ko-annyeong', 'w-ko-gamsahamnida', 'w-ko-juseyo', 'w-ko-ne', 'w-ko-annyeonghi'],
  'seed-arabic-essentials': ['w-ar-marhaba', 'w-ar-shukran', 'w-ar-min-fadlik', 'w-ar-naam', 'w-ar-wadaan'],
  'seed-hindi-basics': ['w-hi-namaste', 'w-hi-dhanyavaad', 'w-hi-kripya', 'w-hi-haan', 'w-hi-alvida'],
  'seed-turkish-basics': ['w-tr-merhaba', 'w-tr-tesekkurler', 'w-tr-lutfen', 'w-tr-evet', 'w-tr-hosca-kal'],
  'seed-persian-basics': ['w-fa-salam', 'w-fa-mamnun', 'w-fa-lotfan', 'w-fa-bale', 'w-fa-khoda-hafez'],
  'seed-dutch-basics': ['w-nl-hallo', 'w-nl-dank-je', 'w-nl-alsjeblieft', 'w-nl-ja', 'w-nl-tot-ziens'],
  'seed-swedish-basics': ['w-sv-hej', 'w-sv-tack', 'w-sv-snalla', 'w-sv-ja', 'w-sv-hej-da'],
  'seed-polish-basics': ['w-pl-czesc', 'w-pl-dziekuje', 'w-pl-prosze', 'w-pl-tak', 'w-pl-do-widzenia'],
  'seed-greek-basics': ['w-el-geia', 'w-el-efharisto', 'w-el-parakalo', 'w-el-nai', 'w-el-antio'],
  'seed-hebrew-basics': ['w-he-shalom', 'w-he-toda', 'w-he-bevakasha', 'w-he-ken', 'w-he-lehitraot'],
  'seed-vietnamese-basics': ['w-vi-xin-chao', 'w-vi-cam-on', 'w-vi-lam-on', 'w-vi-vang', 'w-vi-tam-biet'],
  'seed-thai-basics': ['w-th-sawatdee', 'w-th-khopkhun', 'w-th-garuna', 'w-th-chai', 'w-th-lagon'],
  'seed-indonesian-basics': ['w-id-halo', 'w-id-terima-kasih', 'w-id-tolong', 'w-id-ya', 'w-id-selamat-tinggal'],
  'seed-swahili-basics': ['w-sw-habari', 'w-sw-asante', 'w-sw-tafadhali', 'w-sw-ndiyo', 'w-sw-kwaheri'],
  'seed-ukrainian-basics': ['w-uk-pryvit', 'w-uk-dyakuyu', 'w-uk-bud-laska', 'w-uk-tak', 'w-uk-do-pobachennya'],
  'seed-czech-basics': ['w-cs-ahoj', 'w-cs-dekuji', 'w-cs-prosim', 'w-cs-ano', 'w-cs-na-shledanou'],
  'seed-finnish-basics': ['w-fi-hei', 'w-fi-kiitos', 'w-fi-ole-hyva', 'w-fi-kylla', 'w-fi-nakemiin'],
  'seed-norwegian-basics': ['w-nb-hei', 'w-nb-takk', 'w-nb-vaer-sa-snill', 'w-nb-ja', 'w-nb-ha-det'],
  'seed-danish-basics': ['w-da-hej', 'w-da-tak', 'w-da-vaer-sa-venlig', 'w-da-ja', 'w-da-farvel'],
  'seed-filipino-basics': ['w-fil-kumusta', 'w-fil-salamat', 'w-fil-pakiusap', 'w-fil-oo', 'w-fil-paalam'],
  'seed-mongolian-basics': ['w-mn-sain', 'w-mn-bayarlalaa', 'w-mn-guiya', 'w-mn-tiim', 'w-mn-ugui'],
};

/**
 * Pull the full A1 word pack for a seed set's language when one exists, so the
 * home-screen card reflects the real dataset (200+ words) instead of the small
 * curated demo array.
 *
 * `hydrated` is false when the language HAS a pack but it could not be loaded
 * (offline / fetch error). In that case the curated words are used as a
 * fallback AND the seed-version marker is left behind so the merge retries on
 * a later launch — otherwise the card would stay at ~20 words forever.
 */
async function hydrateSeedWords(set: VocabSet): Promise<{ words: VocabWord[]; hydrated: boolean }> {
  const pack = PACK_LANG[set.lang];
  if (!pack) return { words: set.words, hydrated: true }; // nothing to hydrate
  try {
    const bank = await loadWordBank(pack, 'A1');
    if (bank && bank.words.length > 0) {
      return {
        words: bank.words.map(([target, translation], i) => ({
          id: `pk-${pack}-a1-${i}`,
          target,
          translation,
        })),
        hydrated: true,
      };
    }
  } catch {
    /* offline / pack unavailable: fall back below */
  }
  return { words: set.words, hydrated: false };
}

/** True when `existing` still carries exactly the shipped curated seed words. */
function matchesCuratedSeed(existing: VocabSet, curated: VocabSet): boolean {
  if (existing.words.length !== curated.words.length) return false;
  return curated.words.every((w) => {
    const cur = existing.words.find((x) => x.id === w.id);
    return cur && cur.target === w.target && cur.translation === w.translation;
  });
}

export function useLists() {
  const [sets, setSets] = useState<VocabSet[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const settingsRef = useRef<AppSettings>(DEFAULT_SETTINGS);
  const persistTimerRef = useRef<number | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      let list = await getAllSets();
      // One-time merge of missing seed sets, gated by a version marker so
      // new starter sets reach existing installs without resurrecting seed
      // sets the user deliberately deleted.
      const now = Date.now();
      let seedVersion = 0;
      try {
        seedVersion = Number(window.localStorage.getItem(SEED_VERSION_KEY) ?? 0) || 0;
      } catch {
        seedVersion = 0; // storage unavailable: merge will retry harmlessly
      }
      if (seedVersion < SEED_VERSION) {
        const knownIds = new Set(list.map((s) => s.id));
        // Only advance the version marker when every pack-language seed was
        // actually hydrated; if any fetch failed (offline), keep the marker
        // behind so the merge retries next launch instead of trapping cards
        // at ~20 words forever.
        let hydrationComplete = true;
        for (const set of SEED_SETS) {
          if (!knownIds.has(set.id)) {
            // New install: pull the full A1 word pack when the language has one.
            const h = await hydrateSeedWords(set);
            if (!h.hydrated) hydrationComplete = false;
            await putSet({
              ...set,
              words: h.words,
              createdAt: now,
              updatedAt: now,
            });
          } else {
            // Upgrade in place:
            // 1. If the set still carries exactly its shipped words (the user
            //    never edited it), refresh it with the full vocabulary pack.
            // 2. Attach a CEFR level to sets created before levels existed.
            // Any set the user has touched is left fully untouched.
            const existing = list.find((x) => x.id === set.id);
            if (existing) {
              const originalIds = ORIGINAL_SEED_WORD_IDS[set.id];
              // Untouched = same count as the original 5-word demo set with
              // every original word still matching, OR still exactly the
              // curated seed content (covers the v5 expanded installs). A user
              // who edited any word (even just a translation) keeps theirs.
              const untouched =
                (originalIds &&
                  existing.words.length === originalIds.length &&
                  originalIds.every((id) => {
                    const orig = set.words.find((w) => w.id === id);
                    const cur = existing.words.find((w) => w.id === id);
                    return (
                      cur &&
                      orig &&
                      cur.target === orig.target &&
                      cur.translation === orig.translation
                    );
                  })) ||
                matchesCuratedSeed(existing, set);
              if (untouched) {
                const h = await hydrateSeedWords(set);
                if (!h.hydrated) hydrationComplete = false;
                await putSet({
                  ...existing,
                  words: h.words,
                  cefr: set.cefr ?? existing.cefr,
                });
              } else if (!existing.cefr && set.cefr) {
                await putSet({ ...existing, cefr: set.cefr });
              }
            }
          }
        }
        list = await getAllSets();
        if (hydrationComplete) {
          try {
            window.localStorage.setItem(SEED_VERSION_KEY, String(SEED_VERSION));
          } catch {
            /* ignore */
          }
        }
      }
      const stored = await getSettings();
      if (alive) {
        const merged = { ...DEFAULT_SETTINGS, ...stored };
        settingsRef.current = merged;
        setSets(list);
        setSettings(merged);
        setLoading(false);
      }
    })().catch((err) => {
      console.error('[useLists] hydration failed', err);
      if (alive) setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, []);

  // flush any pending settings write on unmount
  useEffect(
    () => () => {
      if (persistTimerRef.current !== null) clearTimeout(persistTimerRef.current);
    },
    [],
  );

  const saveSet = useCallback(async (set: VocabSet): Promise<VocabSet> => {
    const next = { ...set, updatedAt: Date.now() };
    await putSet(next);
    setSets((prev) => {
      const idx = prev.findIndex((s) => s.id === next.id);
      const copy = [...prev];
      if (idx >= 0) copy[idx] = next;
      else copy.unshift(next);
      return copy;
    });
    return next;
  }, []);

  const removeSet = useCallback(async (id: string) => {
    await dbDeleteSet(id);
    setSets((prev) => prev.filter((s) => s.id !== id));
  }, []);

  // Debounced persistence: state updates are instant; IndexedDB writes coalesce
  // (e.g. during slider drags). No side effects inside the state updater.
  const saveSettings = useCallback((patch: Partial<AppSettings>) => {
    const next = { ...settingsRef.current, ...patch };
    settingsRef.current = next;
    setSettings(next);
    if (persistTimerRef.current !== null) clearTimeout(persistTimerRef.current);
    persistTimerRef.current = window.setTimeout(() => {
      void putSettings(settingsRef.current).catch((err) =>
        console.error('[useLists] save settings', err),
      );
    }, 250);
  }, []);

  return { sets, settings, loading, saveSet, removeSet, saveSettings };
}