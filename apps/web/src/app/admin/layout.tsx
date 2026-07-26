'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { AdminAuthProvider } from '@/features/admin/AdminAuthProvider';
import { AdminShell } from '@/features/admin/AdminShell';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLogin = pathname === '/admin/login';

  return (
    <AdminAuthProvider>
      {isLogin ? children : <AdminShell>{children}</AdminShell>}
    </AdminAuthProvider>
  );
}
