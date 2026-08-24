import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  planLegacySettingsAdoption,
  type LegacySettingsAdoption,
} from './indexedDb';

/**
 * Regression tests for account-scoped settings storage. The settings record
 * (theme, voices, language preferences, plan mirror) must live in the ACTIVE
 * OWNER's database — never the shared legacy device row — so User A and
 * User B on one browser can never see each other's preferences, while guests
 * keep their pre-account behavior (legacy database) unchanged.
 */
const db = readFileSync(join(process.cwd(), 'src/lib/db/indexedDb.ts'), 'utf8');

describe('settings storage is owner-scoped', () => {
  it('reads and writes settings through the ACTIVE OWNER database', () => {
    const getSrc = db.match(/export async function getSettings\(\)[\s\S]*?\n\}/)?.[0];
    const putSrc = db.match(/export async function putSettings\(settings: AppSettings\)[\s\S]*?\n\}/)?.[0];
    expect(getSrc).toBeDefined();
    expect(putSrc).toBeDefined();
    // Both must use the owner-scoped handle (guest = legacy name inside
    // setDatabaseNameForOwner), NOT the shared global handle.
    expect(getSrc).toContain('getSetDb()');
    expect(putSrc).toContain('getSetDb()');
    expect(getSrc).not.toContain('getDb()');
    expect(putSrc).not.toContain('getDb()');
  });

  it('writes backup restores into the active owner scope only', () => {
    const src = db.match(/export async function replaceBackupData\([\s\S]*?\n\}/)?.[0];
    expect(src).toBeDefined();
    expect(src).toContain('getSetDb()');
    expect(src).not.toContain('getDb()');
    expect(src).not.toContain('globalDb');
  });

  it('keeps the guest on the legacy database name', () => {
    expect(db).toContain(
      "return owner ? `audiorepeat-user-${encodeURIComponent(owner)}` : LEGACY_DB_NAME;",
    );
  });
});

describe('legacy device-global settings migration decision', () => {
  function decide(scopedExists: boolean, claimedBy: string | null, owner: string): LegacySettingsAdoption {
    return planLegacySettingsAdoption({ scopedExists, claimedBy, owner });
  }

  it('the first signed-in account adopts the unscoped device record once', () => {
    expect(decide(false, null, 'user-a')).toBe('adopt');
    expect(decide(false, 'user-a', 'user-a')).toBe('adopt');
  });

  it('never migrates one user\'s settings into another user\'s account', () => {
    // User A claimed the legacy record earlier → any other account skips,
    // whether or not that account already has its own scope.
    expect(decide(false, 'user-a', 'user-b')).toBe('skip');
    expect(decide(true, 'user-a', 'user-b')).toBe('skip');
  });

  it('an account with existing scoped settings never re-adopts leftovers', () => {
    // Covers a guest re-creating the legacy row after this account migrated.
    expect(decide(true, null, 'user-a')).toBe('claim-only');
    expect(decide(true, 'user-a', 'user-a')).toBe('claim-only');
  });

  it('records the claim before clearing the shared source (crash-safe order)', () => {
    const migrateSrc = db.match(
      /export async function migrateLegacySettingsToOwner\(owner: string\): Promise<boolean> \{[\s\S]*?\n\}(?=\n\n)/,
    )?.[0];
    expect(migrateSrc).toBeDefined();
    const copyIndex = migrateSrc!.indexOf("scoped.put('settings'");
    const claimIndex = migrateSrc!.indexOf('LEGACY_SETTINGS_CLAIM_KEY, owner');
    const clearIndex = migrateSrc!.indexOf("legacy.delete('settings', 'global')");
    for (const index of [copyIndex, claimIndex, clearIndex]) {
      expect(index).toBeGreaterThan(-1);
    }
    // Claim is recorded no later than the clear; both follow the copy attempt.
    expect(claimIndex).toBeLessThan(clearIndex);
    expect(copyIndex).toBeLessThan(clearIndex);
    // The claim-only path must not touch the legacy row (a guest may own it).
    const claimOnlySection = migrateSrc!.slice(migrateSrc!.indexOf("// claim-only"));
    expect(claimOnlySection).toContain('!claimedBy');
    expect(claimOnlySection).not.toContain("legacy.delete");
  });
});
