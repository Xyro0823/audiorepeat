import { describe, expect, it } from 'vitest';
import { setDatabaseNameForOwner } from './indexedDb';

describe('account-scoped library database names', () => {
  it('keeps the legacy guest database and isolates every signed-in uid', () => {
    expect(setDatabaseNameForOwner(null)).toBe('audiorepeat');
    expect(setDatabaseNameForOwner('uid-a')).toBe('audiorepeat-user-uid-a');
    expect(setDatabaseNameForOwner('uid-b')).not.toBe(setDatabaseNameForOwner('uid-a'));
  });

  it('encodes unusual uid characters instead of treating them as structure', () => {
    expect(setDatabaseNameForOwner('a/b')).toBe('audiorepeat-user-a%2Fb');
  });
});
