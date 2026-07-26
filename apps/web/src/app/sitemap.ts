import type { MetadataRoute } from 'next';
import { getAppUrl } from '@/lib/seo';

export default function sitemap(): MetadataRoute.Sitemap {
  const appUrl = getAppUrl();
  const routes: Array<{
    path: string;
    lastModified: string;
    changeFrequency: MetadataRoute.Sitemap[0]['changeFrequency'];
    priority: number;
  }> = [
    { path: '', lastModified: '2026-07-26', changeFrequency: 'weekly', priority: 1 },
    {
      path: '/workspace',
      lastModified: '2026-07-26',
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      path: '/guide',
      lastModified: '2026-07-26',
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      path: '/about',
      lastModified: '2026-07-26',
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      path: '/feedback',
      lastModified: '2026-07-26',
      changeFrequency: 'monthly',
      priority: 0.4,
    },
    {
      path: '/privacy',
      lastModified: '2026-07-26',
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      path: '/terms',
      lastModified: '2026-07-26',
      changeFrequency: 'yearly',
      priority: 0.3,
    },
  ];
  return routes.map((route) => ({
    url: `${appUrl}${route.path}`,
    lastModified: new Date(route.lastModified),
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}
