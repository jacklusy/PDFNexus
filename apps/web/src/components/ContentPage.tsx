import type { ReactNode } from 'react';
import { SiteHeader, SiteFooter } from '@/components/SiteChrome';

export function ContentPage({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen atmosphere-light">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-6 py-12 md:px-10">
        <h1 className="font-display text-4xl text-[color:var(--color-ink)]">{title}</h1>
        <div className="prose-pdfnexus mt-8 space-y-4 text-sm leading-relaxed text-[color:var(--color-muted)]">
          {children}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
