import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const routes = ['', '/workspace', '/about', '/privacy', '/terms', '/guide', '/feedback'];
  const now = new Date();
  return routes.map((route) => ({
    url: `${appUrl}${route}`,
    lastModified: now,
    changeFrequency: route === '' || route === '/workspace' ? 'weekly' : 'monthly',
    priority: route === '' ? 1 : route === '/workspace' ? 0.9 : 0.5,
  }));
}
