'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Activity,
  AlertTriangle,
  Bell,
  ChartColumn,
  ChevronLeft,
  ChevronRight,
  FileText,
  LayoutDashboard,
  Lock,
  LogOut,
  Menu,
  Search,
  Server,
  Settings,
  Shield,
  Users,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Button, DropdownItem, DropdownMenu, Popover } from '@/shared/ui';
import { useAdminAuth } from './AdminAuthProvider';
import { getApiBase } from '@/lib/api';

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  permission?: string;
};

const NAV: NavItem[] = [
  { href: '/admin', label: 'Overview', icon: LayoutDashboard, permission: 'dashboard.read' },
  { href: '/admin/analytics', label: 'Analytics', icon: ChartColumn, permission: 'analytics.read' },
  { href: '/admin/users', label: 'Users', icon: Users, permission: 'users.read' },
  { href: '/admin/logs', label: 'Logs', icon: FileText, permission: 'logs.read' },
  { href: '/admin/monitoring', label: 'Monitoring', icon: Server, permission: 'monitoring.read' },
  { href: '/admin/audit', label: 'Audit', icon: Shield, permission: 'audit.read' },
  { href: '/admin/errors', label: 'Errors', icon: AlertTriangle, permission: 'errors.read' },
  { href: '/admin/security', label: 'Security', icon: Lock, permission: 'security.read' },
  { href: '/admin/notifications', label: 'Notifications', icon: Bell, permission: 'notifications.read' },
  { href: '/admin/settings', label: 'Settings', icon: Settings, permission: 'settings.write' },
];

const TITLES: Record<string, string> = {
  '/admin': 'Overview',
  '/admin/analytics': 'Analytics',
  '/admin/users': 'Users',
  '/admin/logs': 'Request logs',
  '/admin/monitoring': 'Monitoring',
  '/admin/audit': 'Audit trail',
  '/admin/errors': 'Error events',
  '/admin/security': 'Security',
  '/admin/notifications': 'Notifications',
  '/admin/settings': 'Settings',
};

const SIDEBAR_KEY = 'pdfnexus:admin-sidebar-collapsed';

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout, loading, hasPermission } = useAdminAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [unread, setUnread] = useState(0);
  const [latest, setLatest] = useState<
    Array<{ id: string; title: string; body: string; createdAt: string }>
  >([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const [search, setSearch] = useState('');
  const bellRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(SIDEBAR_KEY) === '1');
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_KEY, collapsed ? '1' : '0');
    } catch {
      // ignore
    }
  }, [collapsed]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!user || !hasPermission('notifications.read')) return;
    const base = getApiBase();
    const es = new EventSource(`${base}/api/admin/notifications/stream`, {
      withCredentials: true,
    });
    es.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data) as {
          unread?: number;
          latest?: Array<{
            id: string;
            title: string;
            body: string;
            createdAt: string;
          }>;
        };
        setUnread(data.unread ?? 0);
        setLatest(data.latest ?? []);
      } catch {
        // ignore malformed
      }
    };
    es.onerror = () => {
      // browser will retry; leave last known values
    };
    return () => es.close();
  }, [user, hasPermission]);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileOpen(false);
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    drawerRef.current?.querySelector<HTMLElement>('a,button')?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  const navItems = useMemo(
    () =>
      NAV.filter(
        (item) => !item.permission || hasPermission(item.permission),
      ),
    [hasPermission],
  );

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--color-canvas)] text-sm text-[var(--color-muted)]">
        Checking session…
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--color-canvas)] text-sm text-[var(--color-muted)]">
        Redirecting to sign in…
      </div>
    );
  }

  const title =
    Object.entries(TITLES).find(
      ([path]) =>
        path === pathname ||
        (path !== '/admin' && pathname?.startsWith(path)),
    )?.[1] || 'Admin';

  const crumbs = [
    { href: '/admin', label: 'Admin' },
    ...(pathname && pathname !== '/admin'
      ? [{ href: pathname, label: title }]
      : []),
  ];

  const NavLinks = (
    <nav className="space-y-1 p-2" aria-label="Admin">
      {navItems.map((item) => {
        const active =
          item.href === '/admin'
            ? pathname === '/admin'
            : pathname?.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            title={item.label}
            className={cn(
              'flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition',
              active
                ? 'bg-[var(--color-accent)] text-white'
                : 'text-[var(--color-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-ink)]',
              collapsed && 'lg:justify-center lg:px-2',
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className={cn('flex-1', collapsed && 'lg:hidden')}>
              {item.label}
            </span>
            {item.href === '/admin/notifications' && unread > 0 ? (
              <span
                className={cn(
                  'rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white',
                  collapsed && 'lg:hidden',
                )}
              >
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
          ref={drawerRef}
          id="admin-sidebar"
          aria-label="Admin navigation"
          aria-modal={mobileOpen || undefined}
          role={mobileOpen ? 'dialog' : undefined}
          className={cn(
            'fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)] transition-all duration-200 lg:static',
            mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
            collapsed && 'lg:w-[4.5rem]',
          )}
        >
          <div className="flex h-14 items-center justify-between border-b border-[var(--color-border)] px-3">
            <Link href="/admin" className="flex items-center gap-2 truncate">
              <Activity className="h-5 w-5 shrink-0 text-[var(--color-accent)]" />
              <span
                className={cn(
                  'font-semibold tracking-tight',
                  collapsed && 'lg:hidden',
                )}
              >
                PDFNexus Admin
              </span>
            </Link>
            <button
              type="button"
              className="rounded-lg p-1.5 text-[var(--color-muted)] hover:bg-[var(--color-surface-2)] lg:hidden"
              onClick={() => setMobileOpen(false)}
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </button>
            <button
              type="button"
              className="hidden rounded-lg p-1.5 text-[var(--color-muted)] hover:bg-[var(--color-surface-2)] lg:inline-flex"
              onClick={() => setCollapsed((v) => !v)}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {collapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </button>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar">{NavLinks}</div>
        </aside>

        {mobileOpen ? (
          <div
            className="fixed inset-0 z-30 bg-black/40 lg:hidden"
            aria-hidden
            onClick={() => setMobileOpen(false)}
          />
        ) : null}

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-[var(--color-border)] bg-[var(--color-surface)]/90 px-3 backdrop-blur sm:px-4">
            <button
              type="button"
              className="rounded-lg border border-[var(--color-border)] p-2 lg:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
              aria-expanded={mobileOpen}
              aria-controls="admin-sidebar"
            >
              <Menu className="h-4 w-4" />
            </button>

            <div className="min-w-0 flex-1">
              <nav
                aria-label="Breadcrumb"
                className="hidden items-center gap-1 text-[11px] text-[var(--color-muted)] sm:flex"
              >
                {crumbs.map((c, i) => (
                  <React.Fragment key={c.href}>
                    {i > 0 ? <span>/</span> : null}
                    <Link
                      href={c.href}
                      className={cn(
                        i === crumbs.length - 1
                          ? 'font-semibold text-[var(--color-ink)]'
                          : 'hover:text-[var(--color-ink)]',
                      )}
                    >
                      {c.label}
                    </Link>
                  </React.Fragment>
                ))}
              </nav>
              <h1 className="truncate text-sm font-bold sm:text-base">{title}</h1>
            </div>

            <form
              className="relative hidden md:block"
              onSubmit={(e) => {
                e.preventDefault();
                const q = search.trim();
                if (!q) return;
                if (hasPermission('logs.read')) {
                  router.push(`/admin/logs?search=${encodeURIComponent(q)}`);
                } else if (hasPermission('users.read')) {
                  router.push(`/admin/users?search=${encodeURIComponent(q)}`);
                }
              }}
            >
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--color-muted)]" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search logs or users…"
                className="h-9 w-48 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] pl-8 pr-3 text-xs outline-none focus:border-[var(--color-accent)] lg:w-64"
                aria-label="Search"
              />
            </form>

            <ThemeToggle compact />

            {hasPermission('notifications.read') ? (
              <>
                <button
                  ref={bellRef}
                  type="button"
                  onClick={() => setNotifOpen((v) => !v)}
                  className="relative rounded-lg border border-[var(--color-border)] p-2"
                  aria-label={`Notifications${unread ? ` (${unread} unread)` : ''}`}
                  aria-expanded={notifOpen}
                >
                  <Bell className="h-4 w-4" />
                  {unread > 0 ? (
                    <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
                      {unread > 99 ? '99+' : unread}
                    </span>
                  ) : null}
                </button>
                <Popover
                  open={notifOpen}
                  onClose={() => setNotifOpen(false)}
                  anchorRef={bellRef}
                  width={340}
                >
                  <div className="border-b border-[var(--color-border)] px-3 py-2 text-xs font-bold uppercase tracking-wide text-[var(--color-muted)]">
                    Notifications
                  </div>
                  {latest.length === 0 ? (
                    <p className="px-3 py-6 text-center text-sm text-[var(--color-muted)]">
                      No unread notifications
                    </p>
                  ) : (
                    <ul className="divide-y divide-[var(--color-border)]">
                      {latest.map((n) => (
                        <li key={n.id} className="px-3 py-2.5">
                          <p className="text-sm font-semibold">{n.title}</p>
                          <p className="mt-0.5 line-clamp-2 text-xs text-[var(--color-muted)]">
                            {n.body}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="border-t border-[var(--color-border)] p-2">
                    <Link
                      href="/admin/notifications"
                      onClick={() => setNotifOpen(false)}
                      className="block rounded-lg px-2 py-1.5 text-center text-xs font-semibold text-[var(--color-accent)] hover:bg-[var(--color-accent-soft)]"
                    >
                      View all
                    </Link>
                  </div>
                </Popover>
              </>
            ) : null}

            <DropdownMenu
              align="end"
              trigger={
                <Button variant="outline" size="sm" className="gap-2">
                  <span className="hidden max-w-[10rem] truncate sm:inline">
                    {user.email}
                  </span>
                  <span className="rounded-full bg-[var(--color-accent-soft)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--color-accent)]">
                    {user.role}
                  </span>
                </Button>
              }
            >
              <DropdownItem onClick={() => router.push('/admin/settings')}>
                <Settings className="h-3.5 w-3.5" /> Account settings
              </DropdownItem>
              <DropdownItem danger onClick={() => void logout()}>
                <LogOut className="h-3.5 w-3.5" /> Sign out
              </DropdownItem>
            </DropdownMenu>
          </header>
          <main className="flex-1 p-4 sm:p-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
