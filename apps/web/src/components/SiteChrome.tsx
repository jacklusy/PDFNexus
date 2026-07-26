'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Layers, Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ThemeToggle } from '@/components/ThemeToggle';

const links = [
  { href: '/workspace', label: 'Workspace' },
  { href: '/guide', label: 'Guide' },
  { href: '/about', label: 'About' },
  { href: '/feedback', label: 'Feedback' },
];

export function SiteHeader({ variant = 'light' }: { variant?: 'light' | 'dark' }) {
  const pathname = usePathname();
  const dark = variant === 'dark';
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panelRef.current?.querySelector<HTMLElement>('a,button')?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  const linkClass = (href: string) =>
    cn(
      'rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]',
      pathname === href
        ? dark
          ? 'bg-white/15 text-white'
          : 'bg-[var(--color-accent-soft)] text-[var(--color-accent)]'
        : dark
          ? 'text-white/75 hover:bg-white/10 hover:text-white'
          : 'text-[var(--color-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-ink)]',
    );

  return (
    <header
      className={cn(
        'relative z-20 flex items-center justify-between gap-3 px-6 py-5 md:px-10',
        dark ? 'text-white' : 'text-[var(--color-ink)]',
      )}
    >
      <Link
        href="/"
        className="flex items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
      >
        <span
          className={cn(
            'flex h-9 w-9 items-center justify-center rounded-lg',
            dark
              ? 'bg-white/15 text-teal-100'
              : 'bg-[var(--color-accent)] text-white',
          )}
        >
          <Layers className="h-4 w-4" />
        </span>
        <span className="font-display text-2xl tracking-tight">PDFNexus</span>
      </Link>

      <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
        {links.map((l) => (
          <Link key={l.href} href={l.href} className={linkClass(l.href)}>
            {l.label}
          </Link>
        ))}
      </nav>

      <div className="flex items-center gap-2">
        <ThemeToggle compact className={dark ? 'border-white/20 bg-white/10' : undefined} />
        <Link
          href="/workspace"
          className={cn(
            'hidden rounded-xl px-4 py-2 text-sm font-bold transition-colors sm:inline-flex focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]',
            dark
              ? 'bg-teal-400 text-teal-950 hover:bg-teal-300'
              : 'bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)]',
          )}
        >
          Open workspace
        </Link>
        <button
          type="button"
          className={cn(
            'inline-flex h-9 w-9 items-center justify-center rounded-lg border md:hidden',
            dark
              ? 'border-white/20 text-white'
              : 'border-[var(--color-border)] text-[var(--color-ink)]',
          )}
          aria-expanded={open}
          aria-controls={panelId}
          aria-label={open ? 'Close menu' : 'Open menu'}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
      </div>

      {open ? (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/40 md:hidden"
            aria-hidden
            onClick={() => setOpen(false)}
          />
          <div
            ref={panelRef}
            id={panelId}
            role="dialog"
            aria-modal="true"
            aria-label="Mobile navigation"
            className="fixed inset-x-3 top-[4.5rem] z-50 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-xl md:hidden"
          >
            <nav className="flex flex-col gap-1" aria-label="Mobile primary">
              {links.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className={cn(
                    'rounded-lg px-3 py-3 text-sm font-semibold',
                    pathname === l.href
                      ? 'bg-[var(--color-accent-soft)] text-[var(--color-accent)]'
                      : 'text-[var(--color-ink)] hover:bg-[var(--color-surface-2)]',
                  )}
                >
                  {l.label}
                </Link>
              ))}
              <Link
                href="/workspace"
                className="mt-2 rounded-xl bg-[var(--color-accent)] px-3 py-3 text-center text-sm font-bold text-white"
              >
                Open workspace
              </Link>
            </nav>
          </div>
        </>
      ) : null}
    </header>
  );
}

export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-12 md:px-10">
      <div className="mx-auto grid max-w-5xl gap-10 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2 lg:col-span-1">
          <p className="font-display text-xl text-[var(--color-ink)]">PDFNexus</p>
          <p className="mt-2 text-sm leading-relaxed text-[var(--color-muted)]">
            Merge and organize PDFs entirely in your browser. Only final files
            leave your device after email verification.
          </p>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-[var(--color-ink)]">
            Product
          </p>
          <ul className="mt-3 space-y-2 text-sm text-[var(--color-muted)]">
            <li>
              <Link href="/workspace" className="hover:text-[var(--color-accent)]">
                Workspace
              </Link>
            </li>
            <li>
              <Link href="/guide" className="hover:text-[var(--color-accent)]">
                Guide
              </Link>
            </li>
            <li>
              <Link href="/about" className="hover:text-[var(--color-accent)]">
                About
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-[var(--color-ink)]">
            Support
          </p>
          <ul className="mt-3 space-y-2 text-sm text-[var(--color-muted)]">
            <li>
              <Link href="/feedback" className="hover:text-[var(--color-accent)]">
                Feedback
              </Link>
            </li>
            <li>
              <Link href="/guide#troubleshooting" className="hover:text-[var(--color-accent)]">
                Troubleshooting
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-[var(--color-ink)]">
            Legal
          </p>
          <ul className="mt-3 space-y-2 text-sm text-[var(--color-muted)]">
            <li>
              <Link href="/privacy" className="hover:text-[var(--color-accent)]">
                Privacy
              </Link>
            </li>
            <li>
              <Link href="/terms" className="hover:text-[var(--color-accent)]">
                Terms
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <p className="mx-auto mt-10 max-w-5xl text-xs text-[var(--color-muted)]">
        © {year} PDFNexus. All rights reserved.
      </p>
    </footer>
  );
}
