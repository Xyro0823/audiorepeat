'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { AppSettings, VocabSet } from '@/types/app';
import { getAuthSnapshot, subscribeAuth } from '@/lib/authStore';
import {
  accountPrefsActivatedFor,
  activateAccountPrefs,
  EMPTY_ACCOUNT_PREFS,
  getAccountPrefsSnapshot,
  subscribeAccountPrefs,
  updateAccountPrefs,
} from '@/lib/accountPrefs';
import { langLimitKey } from '@/lib/planGate';
import { resolveFreeLanguage } from '@/lib/freeLang';
import { readOnboardingPending } from '@/lib/onboarding';
import { isProPlan } from '@/lib/plans';
import { hydrateSeedWords, SEED_SETS } from '@/lib/seedSets';
import { PACK_LANG } from '@/lib/starterSets';
import {
  activateSetOwner,
  clearAllSets as dbClearAllSets,
  deleteSet as dbDeleteSet,
  getAllSets,
  getDeletedSetIds,
  migrateLegacySetsToOwner,
  migrateLegacySettingsToOwner,
  putSet,
  replaceBackupData,
} from '@/lib/db/indexedDb';
import { scheduleLibrarySync, syncLibraryNow } from '@/lib/sync/client';
import {
  getSettingsSnapshot,
  activateSettingsOwner,
  adoptPersistedSettings,
  hydrateSettings,
  refreshSettings,
  replaceSettingsFull,
  subscribeSettings,
  updateSettings,
} from '@/lib/settingsStore';

// Bump this whenever new starter sets are added, so existing installs receive
// them exactly once (a user who deletes a seed set keeps it deleted).
// v7 delivers the English-for-Mongolians starter set to accounts which had
// already completed the v6 merge before that set was introduced.
const SEED_VERSION = 7;
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

function scopedKey(key: string, uid: string | null): string {
  return uid ? `${key}:${uid}` : key;
}

function adoptLegacyStorageKey(key: string, uid: string): void {
  try {
    const target = scopedKey(key, uid);
    if (window.localStorage.getItem(target) !== null) return;
    const legacy = window.localStorage.getItem(key);
    if (legacy !== null) window.localStorage.setItem(target, legacy);
  } catch {
    /* localStorage unavailable — IndexedDB data is still safely migrated */
  }
}

function readDeferredSeedIds(uid: string | null): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(scopedKey(DEFERRED_SEED_KEY, uid));
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) return parsed.filter((x): x is string => typeof x === 'string');
    }
  } catch {
    /* corrupted — treat as empty */
  }
  return [];
}

function writeDeferredSeedIds(uid: string | null, ids: string[]): void {
  try {
    window.localStorage.setItem(scopedKey(DEFERRED_SEED_KEY, uid), JSON.stringify(ids));
  } catch {
    /* storage unavailable — upgrade seeding just won't be deferred */
  }
}

function removeDeferredSeedIds(uid: string | null): void {
  try {
    window.localStorage.removeItem(scopedKey(DEFERRED_SEED_KEY, uid));
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
async function seedDeferredSeeds(now: number, uid: string | null): Promise<{ seeded: number; failed: number }> {
  const deferred = readDeferredSeedIds(uid);
  if (deferred.length === 0) return { seeded: 0, failed: 0 };
  const existingIds = new Set([
    ...(await getAllSets()).map((s) => s.id),
    ...(await getDeletedSetIds()),
  ]);
  const failed: string[] = [];
  let seeded = 0;
  for (const id of deferred) {
    const seed = SEED_SETS.find((s) => s.id === id);
    if (!seed) continue;
    // Idempotent: a set that already exists (e.g. the Free-language starter
    // seeded during onboarding) must never be overwritten — that would erase
    // any mastery marks the user has earned on it.
    if (existingIds.has(id)) {
      seeded += 1;
      continue;
    }
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
  if (failed.length === 0) removeDeferredSeedIds(uid);
  else writeDeferredSeedIds(uid, failed);
  return { seeded, failed: failed.length };
}

export function useLists() {
  const [sets, setSets] = useState<VocabSet[]>([]);
  const [loading, setLoading] = useState(true);
  // Settings are global (shared store): every mounted consumer sees changes
  // immediately — e.g. the Settings modal and the layout-level ThemeManager.
  const settings = useSyncExternalStore(subscribeSettings, getSettingsSnapshot, getSettingsSnapshot);
  // Account-scoped Free-plan prefs (selectedFreeLang/hiddenLangs) live in a
  // per-uid record for signed-in users and in the global settings for guests.
  // The account-prefs store only reports the record of the uid it was last
  // ACTIVATED for; effectiveAccountPrefs treats a not-yet-activated (or stale)
  // snapshot as empty, so another account's prefs can never gate this session.
  const accountSnapshot = useSyncExternalStore(
    subscribeAccountPrefs,
    getAccountPrefsSnapshot,
    getAccountPrefsSnapshot,
  );
  const uid = getAuthSnapshot().user?.id ?? null;
  const accountPrefs = accountPrefsActivatedFor(uid)
    ? accountSnapshot
    : EMPTY_ACCOUNT_PREFS;

  useEffect(() => {
    let alive = true;
    (async () => {
      const uid = getAuthSnapshot().user?.id ?? null;
      const isCurrentOwner = () => (getAuthSnapshot().user?.id ?? null) === uid;
      activateSetOwner(uid);
      activateSettingsOwner(uid);
      if (uid && await migrateLegacySetsToOwner(uid)) {
        adoptLegacyStorageKey(SEED_VERSION_KEY, uid);
        adoptLegacyStorageKey(DEFERRED_SEED_KEY, uid);
      }
      // One-time adoption of the legacy device-global settings record (the
      // auth layer also runs this; both are idempotent and claim-guarded).
      if (uid) {
        try {
          await migrateLegacySettingsToOwner(uid);
        } catch {
          /* hydration below loads whatever this account already has */
        }
      }
      if (!alive || !isCurrentOwner()) return;
      let list = await getAllSets();
      // Offline-first: an existing local library renders immediately while a
      // signed-in account checks for remote changes in the background.
      if (uid && list.length > 0 && alive && isCurrentOwner()) {
        setSets(list);
        setLoading(false);
      }
      if (uid) list = await syncLibraryNow();
      // The auth subscription owns a newer account now. Stop this initial
      // hydration before it can seed, persist settings, or render the
      // previous owner's list into the new session.
      if (!alive || !isCurrentOwner()) return;
      // Hydrate the shared settings store FIRST so the seed merge below can
      // honor the purchased plan: Free seeds only one language, Pro seeds all.
      await hydrateSettings();
      const onboardingPendingMarker = uid ? readOnboardingPending(uid) : false;
      // Point the account-prefs store at this session. Signed-in users read
      // (and, on first activation, one-time adopt the legacy global
      // hiddenLangs from) their OWN uid record — adoption is skipped while a
      // fresh account's onboarding is pending so it never inherits another
      // session's state. Guests keep using the global settings record.
      if (!accountPrefsActivatedFor(uid)) {
        activateAccountPrefs(uid, getSettingsSnapshot(), {
          skipAdoption: !!onboardingPendingMarker,
        });
      }
      // Deterministic migration for legacy Free users with no explicit
      // selected language: infer it from their visible sets when unambiguous.
      // Idempotent — once selectedFreeLang is set this is a no-op, and it
      // never runs for Pro users or while onboarding is pending (the picker
      // decides, and completion records the choice). Only the selection is
      // written — the account's hiddenLangs (e.g. an adopted downgrade set)
      // is preserved, never replaced.
      {
        const ap = getAccountPrefsSnapshot();
        const snap = getSettingsSnapshot();
        if (!isProPlan(snap.plan) && !ap.selectedFreeLang && !onboardingPendingMarker) {
          const res = resolveFreeLanguage(list, ap.hiddenLangs, null);
          if (res.key) {
            updateAccountPrefs({ selectedFreeLang: res.key });
          }
        }
      }
      const pro = isProPlan(getSettingsSnapshot().plan);
      // First-time onboarding: a brand-new Free account must NOT inherit the
      // old Spanish default (or a language a PREVIOUS guest/account chose on
      // this device — settings are device-level) — defer every seed set and
      // let the onboarding flow seed the chosen language instead. The per-uid
      // pending marker is the source of truth; completion clears it.
      const onboardingPending = !pro && onboardingPendingMarker;
      // One-time merge of missing seed sets, gated by a version marker so
      // new starter sets reach existing installs without resurrecting seed
      // sets the user deliberately deleted.
      const now = Date.now();
      let seedVersion = 0;
      try {
        seedVersion = Number(window.localStorage.getItem(scopedKey(SEED_VERSION_KEY, uid)) ?? 0) || 0;
      } catch {
        seedVersion = 0; // storage unavailable: merge will retry harmlessly
      }
      if (seedVersion < SEED_VERSION) {
        const knownIds = new Set([...list.map((s) => s.id), ...(await getDeletedSetIds())]);
        const deferred: string[] = [];
        // Free installs seed only the user's chosen/legacy first language; the
        // remaining seed sets are recorded as deferred and seeded once the
        // user upgrades to Pro. During pending onboarding (no choice yet) ALL
        // seeds are deferred so the onboarding picker decides the language.
        const freeLangKey = getAccountPrefsSnapshot().selectedFreeLang;
        const firstSeedLang =
          freeLangKey && !onboardingPending
            ? (SEED_SETS.find((s) => (PACK_LANG[s.lang] ?? s.lang).toLowerCase() === freeLangKey.toLowerCase())
                ?.lang ?? SEED_SETS[0].lang)
            : SEED_SETS[0].lang;
        const deferAll = onboardingPending;
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
            if (!pro && (deferAll || set.lang !== firstSeedLang)) {
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
          writeDeferredSeedIds(uid, [...new Set([...readDeferredSeedIds(uid), ...deferred])]);
        }
        list = await getAllSets();
        if (hydrationComplete) {
          try {
            window.localStorage.setItem(scopedKey(SEED_VERSION_KEY, uid), String(SEED_VERSION));
          } catch {
            /* ignore */
          }
        }
      }
      // Upgrade path: a Free install deferred the other languages — seed them
      // now that the plan is Pro. No-op for Pro installs (nothing deferred).
      if (pro) {
        const r = await seedDeferredSeeds(now, uid);
        if (r.seeded > 0) list = await getAllSets();
      }
      if (alive && isCurrentOwner()) {
        setSets(list);
        setLoading(false);
      }
      if (uid) scheduleLibrarySync(100);
    })().catch((err) => {
      console.error('[useLists] hydration failed', err);
      if (alive) setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, []);

  // The hydration effect above runs exactly once, so a sign-in, logout, or
  // account switch that happens AFTER mount (auth dialog on an already
  // rendered dashboard) must switch the visible library itself. Without this
  // the previous owner's cards stay on screen, and a fresh sign-in on a new
  // device shows an empty library until a tab refocus happens to re-sync.
  const seenOwnerRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    const switchOwner = (next: string | null) => {
      // Swap BOTH owner-scoped stores immediately: the settings activation
      // resets the shared snapshot to defaults and cancels any pending write
      // from the previous account, so nothing stale can flash or persist.
      activateSetOwner(next);
      activateSettingsOwner(next);
      void (async () => {
        if (next) {
          try {
            await migrateLegacySetsToOwner(next);
          } catch {
            /* the localStorage claim marker prevents a double migration */
          }
          try {
            await migrateLegacySettingsToOwner(next);
          } catch {
            /* claim-guarded; a failure just leaves this account's own record */
          }
        }
        // Load THIS account's (or the guest's) persisted settings before any
        // consumer reads plan/language state from the snapshot.
        await hydrateSettings();
        setSets(await getAllSets());
        setLoading(false);
        if (!next) return;
        if (!accountPrefsActivatedFor(next)) {
          activateAccountPrefs(next, getSettingsSnapshot(), {
            skipAdoption: !!readOnboardingPending(next),
          });
        }
        try {
          setSets(await syncLibraryNow());
        } catch {
          /* offline: the local owner-scoped library is already visible */
        }
      })();
    };
    const onAuthChange = () => {
      const next = getAuthSnapshot().user?.id ?? null;
      if (seenOwnerRef.current === undefined) {
        // First observation: the mount effect owns the initial hydration.
        seenOwnerRef.current = next;
        return;
      }
      if (next === seenOwnerRef.current) return;
      seenOwnerRef.current = next;
      switchOwner(next);
    };
    const unsubscribe = subscribeAuth(onAuthChange);
    onAuthChange();
    return unsubscribe;
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
        const uid = getAuthSnapshot().user?.id ?? null;
        const r = await seedDeferredSeeds(Date.now(), uid);
        // Un-hide languages in THIS account's prefs (guests: global record).
        if (getAccountPrefsSnapshot().hiddenLangs.length > 0) {
          updateAccountPrefs({ hiddenLangs: [] });
        }
        if (r.seeded > 0) {
          setSets(await getAllSets());
          scheduleLibrarySync();
        }
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
      if (getAuthSnapshot().user) {
        void syncLibraryNow().then((list) => setSets(list));
      }
    };
    document.addEventListener('visibilitychange', sync);
    window.addEventListener('focus', sync);
    return () => {
      document.removeEventListener('visibilitychange', sync);
      window.removeEventListener('focus', sync);
    };
  }, []);

  // Onboarding / free-language changes seed sets outside this hook (they write
  // through IndexedDB so they work before the library mounts). Any mounted
  // library re-reads on that signal so the new seed card appears instantly.
  useEffect(() => {
    const reload = () => {
      void getAllSets().then((list) => setSets(list));
      scheduleLibrarySync();
    };
    window.addEventListener('audiorepeat:data-changed', reload);
    return () => window.removeEventListener('audiorepeat:data-changed', reload);
  }, []);

  // A finished cloud sync may have merged remote changes into IndexedDB
  // (badge retry, scheduled push, owner switch). Re-read them into the
  // visible library. Deliberately does NOT schedule another sync — the sync
  // that emitted this event just finished, so re-syncing would loop.
  useEffect(() => {
    const reload = () => {
      void getAllSets().then((list) => setSets(list));
    };
    window.addEventListener('audiorepeat:library-synced', reload);
    return () => window.removeEventListener('audiorepeat:library-synced', reload);
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
    scheduleLibrarySync();
    return next;
  }, []);

  const removeSet = useCallback(async (id: string) => {
    await dbDeleteSet(id);
    setSets((prev) => prev.filter((s) => s.id !== id));
    scheduleLibrarySync();
  }, []);

  /** Full settings replace (backup restore) — not a merge like saveSettings. */
  const replaceSettings = useCallback((next: AppSettings) => {
    replaceSettingsFull(next);
  }, []);

  const restoreBackup = useCallback(async (nextSettings: AppSettings, nextSets: VocabSet[]) => {
    await replaceBackupData(nextSettings, nextSets);
    adoptPersistedSettings(nextSettings);
    setSets([...nextSets].sort((a, b) => b.updatedAt - a.updatedAt));
    scheduleLibrarySync(100);
  }, []);

  /** Delete every set (backup restore / full reset). */
  const clearSets = useCallback(async () => {
    await dbClearAllSets();
    setSets([]);
    scheduleLibrarySync(100);
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
    const hiddenLangs = accountPrefs.hiddenLangs;
    if (hiddenLangs.length === 0) return sets;
    const hidden = new Set(hiddenLangs.map(langLimitKey));
    return sets.filter((s) => !hidden.has(langLimitKey(s.lang)));
  }, [sets, accountPrefs.hiddenLangs]);

  return {
    sets: visibleSets,
    allSets: sets,
    settings,
    /** The Free plan's included language for THIS session (account-scoped). */
    freeLangKey: accountPrefs.selectedFreeLang,
    loading,
    saveSet,
    removeSet,
    saveSettings,
    replaceSettings,
    restoreBackup,
    clearSets,
  };
}
