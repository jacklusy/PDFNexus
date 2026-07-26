'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { ApiError } from '@/lib/api';
import {
  adminLogin as loginApi,
  adminLogout as logoutApi,
  adminMe,
  type AdminMe,
} from './api';

type AdminAuthState = {
  user: AdminMe | null;
  loading: boolean;
  hasPermission: (permission: string) => boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AdminAuthContext = createContext<AdminAuthState | null>(null);

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AdminMe | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();
  const isLogin = pathname === '/admin/login';

  const refresh = useCallback(async () => {
    try {
      const me = await adminMe();
      setUser(me);
      if (isLogin) router.replace('/admin');
    } catch (err) {
      setUser(null);
      if (err instanceof ApiError && err.status === 401 && !isLogin) {
        router.replace('/admin/login');
      }
    } finally {
      setLoading(false);
    }
  }, [isLogin, router]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = useCallback(
    async (email: string, password: string) => {
      const me = await loginApi(email, password);
      setUser(me);
      setLoading(false);
      router.replace('/admin');
    },
    [router],
  );

  const logout = useCallback(async () => {
    try {
      await logoutApi();
    } finally {
      setUser(null);
      router.replace('/admin/login');
    }
  }, [router]);

  const hasPermission = useCallback(
    (permission: string) => Boolean(user?.permissions?.includes(permission)),
    [user],
  );

  const value = useMemo(
    () => ({ user, loading, hasPermission, login, logout, refresh }),
    [user, loading, hasPermission, login, logout, refresh],
  );

  return (
    <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error('useAdminAuth requires AdminAuthProvider');
  return ctx;
}
