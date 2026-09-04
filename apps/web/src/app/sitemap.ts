import type { MetadataRoute } from 'next';
import { SITEMAP_TOOL_ROUTES } from '@/features/tools/toolRoutes';
import { getAppUrl } from '@/lib/seo';

/**
 * Real image build timestamp, injected in apps/web/Dockerfile. Previously each
 * route carried a hardcoded date that could never update; a single honest
 * build date beats per-page dates that are all equally stale. Falls back to
 * evaluation time when the build arg isn't supplied (e.g. local `next build`).
 */
const BUILD_TIME = (() => {
  const raw = process.env.BUILD_TIME?.trim();
  if (raw) {
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return new Date();
})();

export default function sitemap(): MetadataRoute.Sitemap {
  const appUrl = getAppUrl();
  const toolRoutes = SITEMAP_TOOL_ROUTES.map((path) => ({
    path,
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }));
  const routes: Array<{
    path: string;
    changeFrequency: MetadataRoute.Sitemap[0]['changeFrequency'];
    priority: number;
  }> = [
    { path: '', changeFrequency: 'weekly', priority: 1 },
    { path: '/workspace', changeFrequency: 'weekly', priority: 0.9 },
    { path: '/guide', changeFrequency: 'monthly', priority: 0.7 },
    { path: '/about', changeFrequency: 'monthly', priority: 0.5 },
    { path: '/feedback', changeFrequency: 'monthly', priority: 0.4 },
    { path: '/privacy', changeFrequency: 'yearly', priority: 0.3 },
    { path: '/terms', changeFrequency: 'yearly', priority: 0.3 },
    { path: '/cloud', changeFrequency: 'monthly', priority: 0.55 },
    { path: '/tools', changeFrequency: 'weekly', priority: 0.85 },
    { path: '/tools/organize', changeFrequency: 'weekly', priority: 0.75 },
    { path: '/tools/convert', changeFrequency: 'weekly', priority: 0.75 },
    { path: '/tools/edit', changeFrequency: 'weekly', priority: 0.75 },
    { path: '/tools/secure', changeFrequency: 'weekly', priority: 0.75 },
    ...toolRoutes,
  ];
  return routes.map((route) => ({
    url: `${appUrl}${route.path}`,
    lastModified: BUILD_TIME,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}
