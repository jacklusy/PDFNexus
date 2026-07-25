'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { ThemeProvider } from 'next-themes';
import { AdminAuthProvider } from '@/features/admin/AdminAuthProvider';
import { AdminShell } from '@/features/admin/AdminShell';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLogin = pathname === '/admin/login';

  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      {isLogin ? (
        children
      ) : (
        <AdminAuthProvider>
          <AdminShell>{children}</AdminShell>
        </AdminAuthProvider>
      )}
    </ThemeProvider>
  );
}
