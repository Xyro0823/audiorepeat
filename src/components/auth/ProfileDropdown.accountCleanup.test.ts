import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(join(process.cwd(), 'src/components/auth/ProfileDropdown.tsx'), 'utf8');

describe('ProfileDropdown account cleanup', () => {
  it('cleans owner-scoped IndexedDB and guide state only after server deletion succeeds', () => {
    const serverDelete = source.indexOf('const res = await deleteAccount()');
    const successGuard = source.indexOf('if (!res.ok)', serverDelete);
    const databaseDelete = source.indexOf('await deleteSetDatabaseForOwner(deletedUid)', successGuard);
    const guideDelete = source.indexOf('firstSessionGuideKey(deletedUid)', databaseDelete);
    const closeMenu = source.indexOf('setOpen(false)', guideDelete);

    expect(serverDelete).toBeGreaterThan(-1);
    expect(successGuard).toBeGreaterThan(serverDelete);
    expect(databaseDelete).toBeGreaterThan(successGuard);
    expect(guideDelete).toBeGreaterThan(databaseDelete);
    expect(closeMenu).toBeGreaterThan(guideDelete);
  });
});
