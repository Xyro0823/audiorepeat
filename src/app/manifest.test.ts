import { describe, expect, it } from 'vitest';
import manifest from './manifest';

describe('PWA manifest branding', () => {
  it('exposes Evoq as the app name and short name', () => {
    const m = manifest();
    expect(m.name).toContain('Evoq');
    expect(m.short_name).toBe('Evoq');
  });

  it('does not expose the legacy AudioRepeat brand', () => {
    const m = manifest();
    expect(m.name).not.toContain('AudioRepeat');
    expect(m.short_name).not.toContain('AudioRepeat');
  });

  it('keeps the install surface intact', () => {
    const m = manifest();
    expect(m.start_url).toBe('/');
    expect(m.display).toBe('standalone');
    expect(m.icons?.length ?? 0).toBeGreaterThanOrEqual(3);
  });
});
