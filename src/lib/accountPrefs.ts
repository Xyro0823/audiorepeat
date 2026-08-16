import { getAuthSnapshot } from '@/lib/authStore';
import { updateSettings } from '@/lib/settingsStore';
import type { AppSettings } from '@/types/app';

/**
 * Account-scoped Free-plan preferences.
 *
 * The Free-plan language choice (`selectedFreeLang`) and the hidden-language
 * set (`hiddenLangs`) are ACCOUNT-SPECIFIC entitlement state: one Firebase
 * user's choice must never silently leak to another user who signs into the
 * same browser/device. The device's IndexedDB settings record is global by
 * design (theme, audio, reminder, plan), so these two fields live in a
 * per-uid localStorage record — the same account-scoping convention as the
 * stats/streak/username/onboarding keys (lib/auth/scopes.ts, lib/onboarding.ts).
 *
 * Storage:
 *   - Signed-in user U → localStorage key `audiorepeat-account-prefs:U`.
 *   - Guest → the global settings record (settingsStore), preserving the
 *     pre-account architecture exactly. Guests and accounts never share keys,
 *     so a guest's choice cannot contaminate an account and vice versa.
 *
 * Legacy migration (one-time, deterministic):
 *   `hiddenLangs` shipped in the global settings record (a downgrade hides
 *   languages device-wide). The first activation for a signed-in uid with no
 *   record adopts the global hiddenLangs into that uid's record, so a
 *   pre-feature downgrade keeps its hidden languages. Adoption is SKIPPED
 *   while that account's onboarding is pending — a brand-new account must
 *   never inherit another session's state — and never runs for guests.
 *   `selectedFreeLang` never shipped to production, so nothing is adopted for
 *   it: useLists' legacy inference (resolveFreeLanguage) fills it in
 *   deterministically instead.
 */

export interface AccountPrefs {
  /** Chosen Free language, normalized pack key (langLimitKey convention). */
  selectedFreeLang: string | null;
  /** Languages hidden by a Free downgrade/language change (normalized keys). */
  hiddenLangs: string[];
}

export const EMPTY_ACCOUNT_PREFS: AccountPrefs = { selectedFreeLang: null, hiddenLangs: [] };

export const ACCOUNT_PREFS_KEY_PREFIX = 'audiorepeat-account-prefs';

export function accountPrefsKey(uid: string | null | undefined): string {
  return uid ? `${ACCOUNT_PREFS_KEY_PREFIX}:${uid}` : ACCOUNT_PREFS_KEY_PREFIX;
}

export function normalizeAccountPrefs(raw: unknown): AccountPrefs {
  const r = (raw ?? {}) as Partial<AccountPrefs>;
  const selectedFreeLang =
    typeof r.selectedFreeLang === 'string' && r.selectedFreeLang.trim() !== ''
      ? r.selectedFreeLang
      : null;
  const hiddenLangs = Array.isArray(r.hiddenLangs)
    ? r.hiddenLangs.filter((x): x is string => typeof x === 'string')
    : [];
  return { selectedFreeLang, hiddenLangs };
}

export function readAccountPrefs(uid: string | null | undefined): AccountPrefs | null {
  if (typeof window === 'undefined' || !uid) return null;
  try {
    const raw = window.localStorage.getItem(accountPrefsKey(uid));
    if (!raw) return null;
    return normalizeAccountPrefs(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function writeAccountPrefs(uid: string, prefs: AccountPrefs): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(accountPrefsKey(uid), JSON.stringify(prefs));
  } catch {
    /* storage unavailable — the choice just won't persist this session */
  }
}

export function clearAccountPrefs(uid: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(accountPrefsKey(uid));
  } catch {
    /* ignore */
  }
}

/* ------------------------------------------------------------------ */
/* Reactive store (same module-store pattern as settingsStore)         */
/* ------------------------------------------------------------------ */

let activeUid: string | null = null;
let prefs: AccountPrefs = EMPTY_ACCOUNT_PREFS;
let activated = false;
const listeners = new Set<() => void>();

function emit(): void {
  for (const l of [...listeners]) l();
}

export function subscribeAccountPrefs(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Stable snapshot for useSyncExternalStore. */
export function getAccountPrefsSnapshot(): AccountPrefs {
  return prefs;
}

/**
 * True when the store is currently targeted at `uid`. Consumers must only
 * trust the snapshot when this is true — otherwise the snapshot could still
 * hold the PREVIOUS account's record (e.g. during the first render after an
 * account switch, before activation runs) or an empty default.
 */
export function accountPrefsActivatedFor(uid: string | null | undefined): boolean {
  return activated && activeUid === (uid ?? null);
}

/**
 * Target the store at the current session. Call once settings are hydrated
 * (useLists drives this right after hydrateSettings). Signed-in users get
 * their own localStorage record; a uid with no record adopts the legacy
 * global hiddenLangs once (skipped while onboarding is pending) so a
 * pre-feature downgrade keeps its hidden languages. Guests mirror the global
 * settings record — their prefs live there.
 */
export function activateAccountPrefs(
  uid: string | null,
  global: AppSettings,
  opts?: { skipAdoption?: boolean },
): void {
  activeUid = uid;
  if (!uid) {
    prefs = { selectedFreeLang: global.selectedFreeLang, hiddenLangs: global.hiddenLangs ?? [] };
  } else {
    const stored = readAccountPrefs(uid);
    if (stored) {
      prefs = stored;
    } else if (opts?.skipAdoption) {
      prefs = EMPTY_ACCOUNT_PREFS;
    } else {
      prefs = { selectedFreeLang: null, hiddenLangs: global.hiddenLangs ?? [] };
      writeAccountPrefs(uid, prefs);
    }
  }
  activated = true;
  emit();
}

/**
 * Merge a patch into the CURRENT session's prefs and persist. Signed-in users
 * write their uid record; guests write the global settings record (the guest
 * pref store). Safe before activation (e.g. onboarding completing before the
 * dashboard mounts): the persisted record is read back as the merge base, so
 * a previous session's choice is never clobbered by an empty default.
 */
export function updateAccountPrefs(patch: Partial<AccountPrefs>): void {
  const uid = getAuthSnapshot().user?.id ?? null;
  if (!uid) {
    updateSettings({
      ...(patch.selectedFreeLang !== undefined ? { selectedFreeLang: patch.selectedFreeLang } : {}),
      ...(patch.hiddenLangs !== undefined ? { hiddenLangs: patch.hiddenLangs } : {}),
    });
    return;
  }
  const base = accountPrefsActivatedFor(uid)
    ? prefs
    : (readAccountPrefs(uid) ?? EMPTY_ACCOUNT_PREFS);
  prefs = {
    selectedFreeLang:
      patch.selectedFreeLang !== undefined ? patch.selectedFreeLang : base.selectedFreeLang,
    hiddenLangs: patch.hiddenLangs !== undefined ? patch.hiddenLangs : base.hiddenLangs,
  };
  activeUid = uid;
  activated = true;
  writeAccountPrefs(uid, prefs);
  emit();
}

/**
 * The effective prefs for a session: a signed-in user's own record (never
 * another account's — a stale snapshot from a previous uid is treated as
 * empty until activation targets this uid), or the global settings record
 * for guests.
 */
export function effectiveAccountPrefs(
  uid: string | null,
  global: AppSettings,
  acc: AccountPrefs,
): AccountPrefs {
  if (!uid) {
    return { selectedFreeLang: global.selectedFreeLang, hiddenLangs: global.hiddenLangs ?? [] };
  }
  return accountPrefsActivatedFor(uid) ? acc : EMPTY_ACCOUNT_PREFS;
}
