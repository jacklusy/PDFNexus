import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteFooter, SiteHeader } from '@/components/SiteChrome';
import { pageMetadata } from '@/lib/seo';
import { TOOL_CATEGORIES } from '@/features/tools/toolCategories';

export const metadata: Metadata = pageMetadata({
  title: 'PDF Tools — Local & Optional Cloud',
  description:
    'Browse PDFNexus tools by category: organize, convert, edit, and secure. Most tools process locally with immediate downloads.',
  path: '/tools',
});

export default function ToolsIndexPage() {
  return (
    <div className="min-h-screen atmosphere-light">
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-6 py-10 md:px-10">
        <nav aria-label="Breadcrumb" className="mb-4 text-sm text-[var(--color-muted)]">
          <ol className="flex gap-1.5">
            <li>
              <Link href="/" className="hover:text-[var(--color-accent)]">
                Home
              </Link>
            </li>
            <li aria-hidden>/</li>
            <li className="font-medium text-[var(--color-ink)]" aria-current="page">
              Tools
            </li>
          </ol>
        </nav>
        <h1 className="font-display text-4xl text-[var(--color-ink)]">PDF tools</h1>
        <p className="mt-3 max-w-2xl text-[var(--color-muted)]">
          Dedicated pages for each task. Local tools download immediately — no account
          required. Server and OCR features ask for consent first.
        </p>
        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {TOOL_CATEGORIES.map((cat) => (
            <Link
              key={cat.id}
              href={cat.path}
              className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-sm transition hover:border-[var(--color-accent)]"
            >
              <h2 className="font-display text-xl text-[var(--color-ink)]">{cat.title}</h2>
              <p className="mt-2 text-sm text-[var(--color-muted)]">{cat.description}</p>
              <p className="mt-3 text-xs font-semibold text-[var(--color-accent)]">
                {cat.tools.length} tools →
              </p>
            </Link>
          ))}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
