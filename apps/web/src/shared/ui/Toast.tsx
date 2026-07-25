'use client';

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';
import { cn } from '@/lib/utils';

type ToastKind = 'success' | 'error' | 'info';

interface ToastItem {
  id: string;
  kind: ToastKind;
  title: string;
  message?: string;
}

interface ToastContextValue {
  toast: (input: Omit<ToastItem, 'id'>) => void;
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((input: Omit<ToastItem, 'id'>) => {
    const id = crypto.randomUUID();
    setItems((prev) => [...prev.slice(-4), { ...input, id }]);
    window.setTimeout(() => dismiss(id), 4500);
  }, [dismiss]);

  const value = useMemo<ToastContextValue>(
    () => ({
      toast,
      success: (title, message) => toast({ kind: 'success', title, message }),
      error: (title, message) => toast({ kind: 'error', title, message }),
      info: (title, message) => toast({ kind: 'info', title, message }),
    }),
    [toast]
  );

  const icons = {
    success: CheckCircle2,
    error: AlertTriangle,
    info: Info,
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-full max-w-sm flex-col gap-2"
        aria-live="polite"
      >
        <AnimatePresence>
          {items.map((item) => {
            const Icon = icons[item.kind];
            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 12, x: 8 }}
                animate={{ opacity: 1, y: 0, x: 0 }}
                exit={{ opacity: 0, x: 12 }}
                className={cn(
                  'pointer-events-auto flex gap-3 rounded-xl border px-4 py-3 shadow-lg backdrop-blur-md',
                  item.kind === 'success' &&
                    'border-emerald-200/80 bg-emerald-50/95 text-emerald-950',
                  item.kind === 'error' && 'border-red-200/80 bg-red-50/95 text-red-950',
                  item.kind === 'info' &&
                    'border-[color:var(--color-border)] bg-[color:var(--color-surface)]/95 text-[color:var(--color-ink)]'
                )}
              >
                <Icon className="mt-0.5 h-4 w-4 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{item.title}</p>
                  {item.message && (
                    <p className="mt-0.5 text-xs opacity-80">{item.message}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => dismiss(item.id)}
                  className="rounded-md p-1 opacity-60 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-accent)]"
                  aria-label="Dismiss notification"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
