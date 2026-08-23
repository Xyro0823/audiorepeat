import { describe, expect, it } from 'vitest';
import manifest from './manifest';

describe('PWA manifest branding', () => {
  it('exposes AudioRepeat as the app name and short name', () => {
    const m = manifest();
    expect(m.name).toContain('AudioRepeat');
    expect(m.short_name).toBe('AudioRepeat');
  });

  it('does not expose the legacy Evoq brand', () => {
    const m = manifest();
    expect(m.name).not.toContain('Evoq');
    expect(m.short_name).not.toContain('Evoq');
  });

  it('keeps the install surface intact', () => {
    const m = manifest();
    expect(m.display).toBe('standalone');
    expect(m.icons?.length ?? 0).toBeGreaterThanOrEqual(3);
    expect(m.shortcuts).toContainEqual(
      expect.objectContaining({ name: 'Review Today', url: '/review' }),
    );
  });

  it('opens the installed app on the practice dashboard, not marketing', () => {
    const m = manifest();
    // Core learning must be reachable from the very first offline launch.
    expect(m.start_url).toBe('/dashboard');
    expect(m.scope).toBe('/');
  });

  it('keeps app shortcuts inside the app shell', () => {
    const m = manifest();
    for (const shortcut of m.shortcuts ?? []) {
      expect(shortcut.url.startsWith('/')).toBe(true);
      expect(shortcut.url.startsWith('/?')).toBe(false);
    }
    expect(m.shortcuts).toContainEqual(
      expect.objectContaining({ name: 'New set', url: '/dashboard?new=1' }),
    );
  });
});
