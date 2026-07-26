import type { ReactNode } from 'react';
import { SiteHeader, SiteFooter } from '@/components/SiteChrome';

export function ContentPage({
  title,
  description,
  toc,
  children,
}: {
  title: string;
  description?: string;
  toc?: Array<{ id: string; label: string }>;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen atmosphere-light">
      <SiteHeader />
      <main className="mx-auto grid max-w-5xl gap-10 px-6 py-12 md:grid-cols-[220px_1fr] md:px-10">
        {toc?.length ? (
          <aside className="md:sticky md:top-24 md:self-start">
            <p className="text-xs font-bold uppercase tracking-wide text-[var(--color-muted)]">
              On this page
            </p>
            <nav aria-label="Table of contents" className="mt-3 space-y-1.5">
              {toc.map((item) => (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  className="block text-sm text-[var(--color-muted)] hover:text-[var(--color-accent)]"
                >
                  {item.label}
                </a>
              ))}
            </nav>
          </aside>
        ) : (
          <div className="hidden md:block" />
        )}
        <div>
          <h1 className="font-display text-4xl text-[var(--color-ink)]">
            {title}
          </h1>
          {description ? (
            <p className="mt-3 text-sm text-[var(--color-muted)]">{description}</p>
          ) : null}
          <div className="prose-pdfnexus mt-8 space-y-4 text-sm leading-relaxed text-[var(--color-muted)]">
            {children}
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

export function ReviewRequired({ children }: { children: ReactNode }) {
  return (
    <span className="rounded bg-[var(--color-warning-soft)] px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-[var(--color-warning)]">
      REVIEW REQUIRED: {children}
    </span>
  );
}
