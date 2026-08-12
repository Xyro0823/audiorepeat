'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { AppSettings, VocabSet, VocabWord } from '@/types/app';
import { langLimitKey } from '@/lib/planGate';
import { isProPlan } from '@/lib/plans';
import { SEED_SETS } from '@/lib/seedSets';
import { PACK_LANG } from '@/lib/starterSets';
import { loadWordBank } from '@/lib/vocab/wordBanks';
import { clearAllSets as dbClearAllSets, deleteSet as dbDeleteSet, getAllSets, putSet } from '@/lib/db/indexedDb';
import {
  getSettingsSnapshot,
  hydrateSettings,
  refreshSettings,
  replaceSettingsFull,
  subscribeSettings,
  updateSettings,
} from '@/lib/settingsStore';

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
    // Mastery marks count as user edits: a mastered seed set must NOT be
    // re-hydrated with fresh words (that would silently erase the marks).
    return (
      cur &&
      cur.target === w.target &&
      cur.translation === w.translation &&
      cur.mastery === w.mastery
    );
  });
}

/* ------------------------------------------------------------------ */
/* Free-plan deferred seeding                                          */
/* ------------------------------------------------------------------ */
// A Free install seeds only the first language's starter set; the remaining
// seed sets are recorded here and seeded once the user upgrades to Pro. This
// is what makes the "unlock the rest" upgrade path work: the version marker
// can advance for the free install (so deleted seeds stay deleted), while the
// deferred list remembers what was held back.
const DEFERRED_SEED_KEY = 'audiorepeat-deferred-seed-ids';

function readDeferredSeedIds(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(DEFERRED_SEED_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) return parsed.filter((x): x is string => typeof x === 'string');
    }
  } catch {
    /* corrupted — treat as empty */
  }
  return [];
}

function writeDeferredSeedIds(ids: string[]): void {
  try {
    window.localStorage.setItem(DEFERRED_SEED_KEY, JSON.stringify(ids));
  } catch {
    /* storage unavailable — upgrade seeding just won't be deferred */
  }
}

function removeDeferredSeedIds(): void {
  try {
    window.localStorage.removeItem(DEFERRED_SEED_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Seed every deferred (Free-plan) seed set now that the user is Pro. Each
 * deferred language is hydrated with its full A1 word pack, matching how the
 * main merge seeds new installs. The deferred list is cleared only when every
 * seed succeeded; failed ids stay behind for a retry on the next launch.
 */
async function seedDeferredSeeds(now: number): Promise<{ seeded: number; failed: number }> {
  const deferred = readDeferredSeedIds();
  if (deferred.length === 0) return { seeded: 0, failed: 0 };
  const failed: string[] = [];
  let seeded = 0;
  for (const id of deferred) {
    const seed = SEED_SETS.find((s) => s.id === id);
    if (!seed) continue;
    try {
      const h = await hydrateSeedWords(seed);
      if (!h.hydrated) {
        failed.push(id);
        continue;
      }
      await putSet({ ...seed, words: h.words, createdAt: now, updatedAt: now });
      seeded += 1;
    } catch {
      failed.push(id);
    }
  }
  if (failed.length === 0) removeDeferredSeedIds();
  else writeDeferredSeedIds(failed);
  return { seeded, failed: failed.length };
}

export function useLists() {
  const [sets, setSets] = useState<VocabSet[]>([]);
  const [loading, setLoading] = useState(true);
  // Settings are global (shared store): every mounted consumer sees changes
  // immediately — e.g. the Settings modal and the layout-level ThemeManager.
  const settings = useSyncExternalStore(subscribeSettings, getSettingsSnapshot, getSettingsSnapshot);

  useEffect(() => {
    let alive = true;
    (async () => {
      let list = await getAllSets();
      // Hydrate the shared settings store FIRST so the seed merge below can
      // honor the purchased plan: Free seeds only one language, Pro seeds all.
      await hydrateSettings();
      const pro = isProPlan(getSettingsSnapshot().plan);
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
        const deferred: string[] = [];
        // Free installs seed only the first language; the remaining seed sets
        // are recorded as deferred and seeded once the user upgrades to Pro.
        const firstSeedLang = SEED_SETS[0].lang;
        // Only advance the version marker when every pack-language seed was
        // actually hydrated; if any fetch failed (offline), keep the marker
        // behind so the merge retries next launch instead of trapping cards
        // at ~20 words forever.
        let hydrationComplete = true;
        for (const set of SEED_SETS) {
          if (!knownIds.has(set.id)) {
            // New install: pull the full A1 word pack when the language has one.
            // A Free user gets their first language only — any other new
            // language is recorded as deferred for a future upgrade.
            if (!pro && set.lang !== firstSeedLang) {
              deferred.push(set.id);
              continue;
            }
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
                      cur.translation === orig.translation &&
                      cur.mastery === orig.mastery
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
        if (deferred.length > 0) {
          // Persist (merging with anything deferred by an earlier run) so the
          // deferred languages are seeded the moment the plan becomes Pro.
          writeDeferredSeedIds([...new Set([...readDeferredSeedIds(), ...deferred])]);
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
      // Upgrade path: a Free install deferred the other languages — seed them
      // now that the plan is Pro. No-op for Pro installs (nothing deferred).
      if (pro) {
        const r = await seedDeferredSeeds(now);
        if (r.seeded > 0) list = await getAllSets();
      }
      if (alive) {
        setSets(list);
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

  // When the plan flips to Pro in-place (a successful checkout, or restoring
  // a Pro backup while the dashboard is already mounted), seed the languages a
  // Free install deferred AND un-hide any languages a downgrade hid — sets
  // return automatically. Idempotent with the mount-time check — fresh Pro
  // installs never write the deferred list, so this is a no-op for them.
  const prevPlanRef = useRef(settings.plan);
  useEffect(() => {
    const current = settings.plan;
    const upgraded = !isProPlan(prevPlanRef.current) && isProPlan(current);
    prevPlanRef.current = current;
    if (!upgraded) return;
    void (async () => {
      try {
        const r = await seedDeferredSeeds(Date.now());
        if (getSettingsSnapshot().hiddenLangs.length > 0) {
          updateSettings({ hiddenLangs: [] });
        }
        if (r.seeded > 0) setSets(await getAllSets());
      } catch {
        /* failed ids stay deferred — retried on the next launch */
      }
    })();
  }, [settings.plan]);

  // Live cross-tab sync: the settings store is in-memory and only hydrates
  // once, so a plan change made in ANOTHER tab (e.g. a checkout finishing
  // there, or a downgrade from a second window) wouldn't be seen until a
  // reload. On refocus, re-read persisted settings — the plan-flip effect
  // above then seeds deferred languages / restores hidden ones as needed.
  useEffect(() => {
    const sync = () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      void refreshSettings();
    };
    document.addEventListener('visibilitychange', sync);
    window.addEventListener('focus', sync);
    return () => {
      document.removeEventListener('visibilitychange', sync);
      window.removeEventListener('focus', sync);
    };
  }, []);

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

  /** Full settings replace (backup restore) — not a merge like saveSettings. */
  const replaceSettings = useCallback((next: AppSettings) => {
    replaceSettingsFull(next);
  }, []);

  /** Delete every set (backup restore / full reset). */
  const clearSets = useCallback(async () => {
    await dbClearAllSets();
    setSets([]);
  }, []);

  // Debounced persistence: state updates are instant; IndexedDB writes coalesce
  // (e.g. during slider drags). No side effects inside the state updater.
  const saveSettings = useCallback((patch: Partial<AppSettings>) => {
    updateSettings(patch);
  }, []);

  // A Free-plan downgrade hides every language except the one the user chose to
  // keep. Hidden sets stay in IndexedDB (nothing is deleted — upgrade restores
  // them), but every UI surface sees only the visible ones via this filter.
  // `allSets` is the unfiltered list, used by backup export so hidden sets are
  // never lost when moving devices.
  const visibleSets = useMemo(() => {
    if (settings.hiddenLangs.length === 0) return sets;
    const hidden = new Set(settings.hiddenLangs.map(langLimitKey));
    return sets.filter((s) => !hidden.has(langLimitKey(s.lang)));
  }, [sets, settings.hiddenLangs]);

  return {
    sets: visibleSets,
    allSets: sets,
    settings,
    loading,
    saveSet,
    removeSet,
    saveSettings,
    replaceSettings,
    clearSets,
  };
}