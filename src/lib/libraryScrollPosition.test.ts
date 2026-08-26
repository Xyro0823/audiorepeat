import { beforeEach, describe, expect, it, vi } from 'vitest';

const storage = new Map<string, string>();
vi.stubGlobal('window', {
  sessionStorage: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  },
});

import {
  hasDashboardScrollPosition,
  saveDashboardScrollPosition,
  takeDashboardScrollPosition,
} from './libraryScrollPosition';

beforeEach(() => storage.clear());

describe('dashboard library scroll return', () => {
  it('restores the saved position once, then lets ordinary visits start at top', () => {
    saveDashboardScrollPosition(718.7);
    expect(hasDashboardScrollPosition()).toBe(true);
    expect(takeDashboardScrollPosition()).toBe(719);
    expect(hasDashboardScrollPosition()).toBe(false);
    expect(takeDashboardScrollPosition()).toBeNull();
  });

  it('never restores an invalid or negative position', () => {
    saveDashboardScrollPosition(-40);
    expect(takeDashboardScrollPosition()).toBe(0);
  });
});
