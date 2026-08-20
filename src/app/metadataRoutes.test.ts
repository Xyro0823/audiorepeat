import { describe, expect, it } from 'vitest';
import robots from './robots';
import sitemap from './sitemap';

describe('public metadata routes', () => {
  it('lists the public pages in the sitemap', () => {
    const urls = sitemap().map((entry) => entry.url);
    expect(urls.some((url) => url.endsWith('/privacy'))).toBe(true);
    expect(urls.some((url) => url.endsWith('/terms'))).toBe(true);
    expect(urls.some((url) => url.includes('/admin'))).toBe(false);
  });

  it('keeps private and transactional routes out of search results', () => {
    const route = robots();
    expect(route.rules).toMatchObject({ disallow: ['/admin/', '/api/', '/checkout/'] });
    expect(route.sitemap).toContain('/sitemap.xml');
  });
});

