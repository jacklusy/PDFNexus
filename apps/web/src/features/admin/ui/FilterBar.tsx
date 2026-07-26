'use client';

import React, { useCallback, useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { X } from 'lucide-react';
import { Button, Input, Select } from '@/shared/ui';
import { cn } from '@/lib/utils';

export type FilterDef =
  | {
      type: 'text';
      key: string;
      label: string;
      placeholder?: string;
    }
  | {
      type: 'select';
      key: string;
      label: string;
      options: Array<{ value: string; label: string }>;
      placeholder?: string;
    }
  | {
      type: 'multiselect';
      key: string;
      label: string;
      options: Array<{ value: string; label: string }>;
    }
  | {
      type: 'date';
      key: string;
      label: string;
    };

function parseMulti(value: string | null): string[] {
  if (!value) return [];
  return value.split(',').map((s) => s.trim()).filter(Boolean);
}

export function useUrlFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const get = useCallback(
    (key: string) => searchParams.get(key) ?? '',
    [searchParams],
  );

  const getMulti = useCallback(
    (key: string) => parseMulti(searchParams.get(key)),
    [searchParams],
  );

  const setMany = useCallback(
    (updates: Record<string, string | string[] | null | undefined>, resetPage = true) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(updates)) {
        if (v == null || v === '' || (Array.isArray(v) && v.length === 0)) {
          next.delete(k);
        } else if (Array.isArray(v)) {
          next.set(k, v.join(','));
        } else {
          next.set(k, v);
        }
      }
      if (resetPage) next.set('page', '1');
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const clear = useCallback(
    (keys?: string[]) => {
      if (!keys) {
        router.replace(pathname, { scroll: false });
        return;
      }
      const next = new URLSearchParams(searchParams.toString());
      for (const k of keys) next.delete(k);
      next.delete('page');
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  return { get, getMulti, setMany, clear, searchParams };
}

export function FilterBar({
  filters,
  className,
  trailing,
}: {
  filters: FilterDef[];
  className?: string;
  trailing?: React.ReactNode;
}) {
  const { get, getMulti, setMany, clear } = useUrlFilters();

  const chips = useMemo(() => {
    const out: Array<{ key: string; label: string; value: string }> = [];
    for (const f of filters) {
      if (f.type === 'multiselect') {
        for (const v of getMulti(f.key)) {
          const opt = f.options.find((o) => o.value === v);
          out.push({
            key: f.key,
            label: f.label,
            value: opt?.label || v,
          });
        }
      } else {
        const v = get(f.key);
        if (!v) continue;
        if (f.type === 'select') {
          const opt = f.options.find((o) => o.value === v);
          out.push({ key: f.key, label: f.label, value: opt?.label || v });
        } else {
          out.push({ key: f.key, label: f.label, value: v });
        }
      }
    }
    return out;
  }, [filters, get, getMulti]);

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex flex-wrap items-end gap-3">
        {filters.map((f) => {
          if (f.type === 'text') {
            return (
              <div key={f.key} className="min-w-[10rem] flex-1 sm:max-w-xs">
                <Input
                  label={f.label}
                  placeholder={f.placeholder}
                  defaultValue={get(f.key)}
                  onBlur={(e) => setMany({ [f.key]: e.target.value.trim() })}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      setMany({
                        [f.key]: (e.target as HTMLInputElement).value.trim(),
                      });
                    }
                  }}
                />
              </div>
            );
          }
          if (f.type === 'date') {
            return (
              <div key={f.key} className="w-[10rem]">
                <Input
                  label={f.label}
                  type="date"
                  value={get(f.key)}
                  onChange={(e) => setMany({ [f.key]: e.target.value })}
                />
              </div>
            );
          }
          if (f.type === 'select') {
            return (
              <div key={f.key} className="w-[10rem]">
                <Select
                  label={f.label}
                  placeholder={f.placeholder || 'Any'}
                  options={f.options}
                  value={get(f.key)}
                  onChange={(e) => setMany({ [f.key]: e.target.value })}
                />
              </div>
            );
          }
          // multiselect as multi checkbox dropdown-like select (native multiple)
          const selected = new Set(getMulti(f.key));
          return (
            <div key={f.key} className="min-w-[12rem]">
              <span className="mb-1.5 block text-xs font-semibold text-[var(--color-ink)]">
                {f.label}
              </span>
              <div className="flex max-h-28 flex-wrap gap-1 overflow-y-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-2">
                {f.options.map((o) => {
                  const on = selected.has(o.value);
                  return (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() => {
                        const next = new Set(selected);
                        if (on) next.delete(o.value);
                        else next.add(o.value);
                        setMany({ [f.key]: [...next] });
                      }}
                      className={cn(
                        'rounded-full px-2 py-0.5 text-[11px] font-semibold',
                        on
                          ? 'bg-[var(--color-accent)] text-white'
                          : 'bg-[var(--color-surface-2)] text-[var(--color-muted)]',
                      )}
                    >
                      {o.label}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
        {trailing}
        {chips.length > 0 ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => clear(filters.map((f) => f.key))}
          >
            Clear filters
          </Button>
        ) : null}
      </div>

      {chips.length > 0 ? (
        <div className="flex flex-wrap gap-1.5" aria-label="Active filters">
          {chips.map((c, i) => (
            <button
              key={`${c.key}-${c.value}-${i}`}
              type="button"
              className="inline-flex items-center gap-1 rounded-full bg-[var(--color-accent-soft)] px-2.5 py-1 text-[11px] font-semibold text-[var(--color-accent)]"
              onClick={() => {
                const def = filters.find((f) => f.key === c.key);
                if (def?.type === 'multiselect') {
                  const next = getMulti(c.key).filter((v) => {
                    const opt = def.options.find((o) => o.value === v);
                    return (opt?.label || v) !== c.value;
                  });
                  setMany({ [c.key]: next });
                } else {
                  setMany({ [c.key]: null });
                }
              }}
            >
              {c.label}: {c.value}
              <X className="h-3 w-3" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
