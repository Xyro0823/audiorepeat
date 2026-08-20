import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';

export default function sitemap(): MetadataRoute.Sitemap {
  const pages = [
    { path: '', priority: 1, changeFrequency: 'weekly' as const },
    { path: '/dashboard', priority: 0.8, changeFrequency: 'monthly' as const },
    { path: '/privacy', priority: 0.3, changeFrequency: 'yearly' as const },
    { path: '/terms', priority: 0.3, changeFrequency: 'yearly' as const },
    { path: '/refunds', priority: 0.3, changeFrequency: 'yearly' as const },
  ];
  return pages.map(({ path, ...entry }) => ({ url: `${SITE_URL}${path}`, ...entry }));
}

