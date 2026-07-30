import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SiteFooter, SiteHeader } from '@/components/SiteChrome';
import { pageMetadata, getAppUrl } from '@/lib/seo';
import {
  getToolCategory,
  type ToolCategoryId,
} from '@/features/tools/toolCategories';

const IDS: ToolCategoryId[] = ['organize', 'convert', 'edit', 'secure'];

export function generateStaticParams() {
  return IDS.map((category) => ({ category }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string }>;
}): Promise<Metadata> {
  const { category } = await params;
  const cat = getToolCategory(category as ToolCategoryId);
  if (!cat) return {};
  return pageMetadata({
    title: cat.title,
    description: cat.description,
    path: cat.path,
  });
}

export default async function ToolCategoryPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category } = await params;
  const cat = getToolCategory(category as ToolCategoryId);
  if (!cat) notFound();

  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: getAppUrl() },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Tools',
        item: `${getAppUrl()}/tools`,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: cat.title,
        item: `${getAppUrl()}${cat.path}`,
      },
    ],
  };

  return (
    <div className="min-h-screen atmosphere-light">
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-6 py-10 md:px-10">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
        />
        <nav aria-label="Breadcrumb" className="mb-4 text-sm text-[var(--color-muted)]">
          <ol className="flex flex-wrap gap-1.5">
            <li>
              <Link href="/" className="hover:text-[var(--color-accent)]">
                Home
              </Link>
            </li>
            <li aria-hidden>/</li>
            <li>
              <Link href="/tools" className="hover:text-[var(--color-accent)]">
                Tools
              </Link>
            </li>
            <li aria-hidden>/</li>
            <li className="font-medium text-[var(--color-ink)]" aria-current="page">
              {cat.title}
            </li>
          </ol>
        </nav>
        <h1 className="font-display text-4xl text-[var(--color-ink)]">{cat.title}</h1>
        <p className="mt-3 max-w-2xl text-[var(--color-muted)]">{cat.description}</p>
        <ul className="mt-10 grid gap-3 sm:grid-cols-2">
          {cat.tools.map((t) => (
            <li key={t.href}>
              <Link
                href={t.href}
                className="block rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm transition hover:border-[var(--color-accent)]"
              >
                <span className="font-semibold text-[var(--color-ink)]">{t.label}</span>
                <span className="mt-1 block text-sm text-[var(--color-muted)]">
                  {t.blurb}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </main>
      <SiteFooter />
    </div>
  );
}
