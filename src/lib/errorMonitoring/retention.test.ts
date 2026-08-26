import { describe, expect, it, vi } from 'vitest';
import { Timestamp } from 'firebase-admin/firestore';
import { pruneExpiredDiagnostics } from './retention';

describe('diagnostic retention fallback', () => {
  it('deletes only a bounded batch of documents whose expiry has passed', async () => {
    const deleteDoc = vi.fn();
    const commit = vi.fn().mockResolvedValue(undefined);
    const get = vi.fn().mockResolvedValue({
      empty: false,
      size: 2,
      docs: [{ ref: 'expired-a' }, { ref: 'expired-b' }],
    });
    const limit = vi.fn(() => ({ get }));
    const where = vi.fn(() => ({ limit }));
    const db = {
      collection: vi.fn(() => ({ where })),
      batch: vi.fn(() => ({ delete: deleteDoc, commit })),
    };

    await expect(pruneExpiredDiagnostics(db as never, 'client_errors', Timestamp.now(), 100)).resolves.toBe(2);
    expect(where).toHaveBeenCalledWith('expiresAt', '<=', expect.anything());
    expect(limit).toHaveBeenCalledWith(100);
    expect(deleteDoc).toHaveBeenCalledTimes(2);
    expect(commit).toHaveBeenCalledOnce();
  });

  it('does not open a delete batch when there is nothing to remove', async () => {
    const get = vi.fn().mockResolvedValue({ empty: true, size: 0, docs: [] });
    const db = {
      collection: vi.fn(() => ({ where: () => ({ limit: () => ({ get }) }) })),
      batch: vi.fn(),
    };

    await expect(pruneExpiredDiagnostics(db as never, 'webhook_failures')).resolves.toBe(0);
    expect(db.batch).not.toHaveBeenCalled();
  });
});
