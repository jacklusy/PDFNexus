'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Layers } from 'lucide-react';
import { cn } from '@/lib/utils';

const links = [
  { href: '/workspace', label: 'Workspace' },
  { href: '/guide', label: 'Guide' },
  { href: '/about', label: 'About' },
  { href: '/feedback', label: 'Feedback' },
];

export function SiteHeader({ variant = 'light' }: { variant?: 'light' | 'dark' }) {
  const pathname = usePathname();
  const dark = variant === 'dark';

  return (
    <header
      className={cn(
        'relative z-20 flex items-center justify-between px-6 py-5 md:px-10',
        dark ? 'text-white' : 'text-[color:var(--color-ink)]'
      )}
    >
      <Link
        href="/"
        className="flex items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
      >
        <span
          className={cn(
            'flex h-9 w-9 items-center justify-center rounded-lg',
            dark ? 'bg-white/15 text-teal-100' : 'bg-teal-800 text-white'
          )}
        >
          <Layers className="h-4.5 w-4.5" />
        </span>
        <span className="font-display text-2xl tracking-tight">PDFNexus</span>
      </Link>

      <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={cn(
              'rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400',
              pathname === l.href
                ? dark
                  ? 'bg-white/15 text-white'
                  : 'bg-teal-50 text-teal-900'
                : dark
                  ? 'text-white/75 hover:bg-white/10 hover:text-white'
                  : 'text-[color:var(--color-muted)] hover:bg-[color:var(--color-surface-2)] hover:text-[color:var(--color-ink)]'
            )}
          >
            {l.label}
          </Link>
        ))}
      </nav>

      <Link
        href="/workspace"
        className={cn(
          'rounded-xl px-4 py-2 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400',
          dark
            ? 'bg-teal-400 text-teal-950 hover:bg-teal-300'
            : 'bg-teal-800 text-white hover:bg-teal-900'
        )}
      >
        Open workspace
      </Link>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-6 py-10 md:px-10">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="font-display text-lg text-[color:var(--color-ink)]">PDFNexus</p>
          <p className="mt-1 text-sm text-[color:var(--color-muted)]">
            Local merge & organize. Verified delivery when you download.
          </p>
        </div>
        <div className="flex flex-wrap gap-4 text-sm font-medium text-[color:var(--color-muted)]">
          <Link href="/privacy" className="hover:text-teal-800">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-teal-800">
            Terms
          </Link>
          <Link href="/guide" className="hover:text-teal-800">
            Guide
          </Link>
          <Link href="/feedback" className="hover:text-teal-800">
            Feedback
          </Link>
        </div>
      </div>
    </footer>
  );
}
