import { describe, expect, it, vi } from 'vitest';

describe('client-graph self-registration smoke', () => {
  it('importing the dashboard client entry registers its namespace', async () => {
    vi.resetModules();
    await import('@/components/library/SetLibrary');
    const { getDictionary } = await import('@/lib/i18n/dictionaries');
    const table = getDictionary('en');
    expect(table['dashboard.welcome.title']).toBeDefined();
    expect(table['library.typeToSearch']).toBeDefined();
  });
});
