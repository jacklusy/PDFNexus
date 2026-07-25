'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';
import {
  Activity,
  AlertTriangle,
  Bell,
  ChartColumn,
  FileText,
  LayoutDashboard,
  Lock,
  LogOut,
  Menu,
  Moon,
  Server,
  Settings,
  Shield,
  Sun,
  Users,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAdminAuth } from './AdminAuthProvider';
import { adminNotifications } from './api';

const NAV = [
  { href: '/admin', label: 'Overview', icon: LayoutDashboard },
  { href: '/admin/analytics', label: 'Analytics', icon: ChartColumn },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/logs', label: 'Logs', icon: FileText },
  { href: '/admin/monitoring', label: 'Monitoring', icon: Server },
  { href: '/admin/audit', label: 'Audit', icon: Shield },
  { href: '/admin/errors', label: 'Errors', icon: AlertTriangle },
  { href: '/admin/security', label: 'Security', icon: Lock },
  { href: '/admin/notifications', label: 'Notifications', icon: Bell },
  { href: '/admin/settings', label: 'Settings', icon: Settings },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, logout, loading } = useAdminAuth();
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const data = await adminNotifications({ pageSize: 1 });
        if (!cancelled) setUnread(data.unread ?? 0);
      } catch {
        // ignore
      }
    };
    void load();
    const id = window.setInterval(load, 20000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--color-canvas)] text-sm text-[var(--color-muted)]">
        Checking session…
      </div>
    );
  }

  if (!user) return null;

  const NavLinks = (
    <nav className="space-y-1 p-3">
      {NAV.map((item) => {
        const active =
          item.href === '/admin'
            ? pathname === '/admin'
            : pathname?.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setOpen(false)}
            className={cn(
              'flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition',
              active
                ? 'bg-[var(--color-accent)] text-white'
                : 'text-[var(--color-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-ink)]',
            )}
          >
            <Icon className="h-4 w-4" />
            <span className="flex-1">{item.label}</span>
            {item.href === '/admin/notifications' && unread > 0 ? (
              <span className="rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
                {unread}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen bg-[var(--color-canvas)] text-[var(--color-ink)]">
      <div className="mx-auto flex min-h-screen max-w-[1600px]">
        <aside
          className={cn(
            'fixed inset-y-0 left-0 z-40 w-64 border-r border-[var(--color-border)] bg-[var(--color-surface)] transition-transform lg:static lg:translate-x-0',
            open ? 'translate-x-0' : '-translate-x-full',
          )}
        >
          <div className="flex h-14 items-center justify-between border-b border-[var(--color-border)] px-4">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-[var(--color-accent)]" />
              <span className="font-semibold tracking-tight">PDFNexus Admin</span>
            </div>
            <button
              type="button"
              className="lg:hidden"
              onClick={() => setOpen(false)}
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          {NavLinks}
        </aside>

        {open ? (
          <button
            type="button"
            className="fixed inset-0 z-30 bg-black/40 lg:hidden"
            aria-label="Close overlay"
            onClick={() => setOpen(false)}
          />
        ) : null}

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b border-[var(--color-border)] bg-[var(--color-surface)]/90 px-4 backdrop-blur">
            <button
              type="button"
              className="rounded-lg border border-[var(--color-border)] p-2 lg:hidden"
              onClick={() => setOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="h-4 w-4" />
            </button>
            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="rounded-lg border border-[var(--color-border)] p-2"
                aria-label="Toggle theme"
              >
                {theme === 'dark' ? (
                  <Sun className="h-4 w-4" />
                ) : (
                  <Moon className="h-4 w-4" />
                )}
              </button>
              <div className="hidden text-right text-xs sm:block">
                <div className="font-medium">{user.email}</div>
                <div className="text-[var(--color-muted)]">{user.role}</div>
              </div>
              <button
                type="button"
                onClick={() => void logout()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-3 py-2 text-xs font-semibold"
              >
                <LogOut className="h-3.5 w-3.5" />
                Logout
              </button>
            </div>
          </header>
          <main className="flex-1 p-4 sm:p-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
