import Link from 'next/link';
import { SiteFooter, SiteHeader } from '@/components/SiteChrome';
import { Button } from '@/shared/ui';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col bg-[var(--color-canvas)]">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center px-6 py-16 text-center">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--color-accent)]">
          404
        </p>
        <h1 className="mt-3 font-display text-4xl text-[var(--color-ink)]">
          Page not found
        </h1>
        <p className="mt-3 text-sm text-[var(--color-muted)]">
          That URL doesn’t exist. Head back to the homepage or open the
          workspace to keep working with your PDFs.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/">
            <Button>Go home</Button>
          </Link>
          <Link href="/workspace">
            <Button variant="outline">Open workspace</Button>
          </Link>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
