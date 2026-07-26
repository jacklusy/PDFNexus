import React from 'react';
import { cn } from '@/lib/utils';

const fieldBase =
  'w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-ink)] placeholder:text-[var(--color-muted)] transition focus:border-[var(--color-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30 disabled:opacity-50';

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, hint, error, id, ...props }, ref) => {
    const inputId = id || props.name;
    return (
      <label className="block space-y-1.5">
        {label ? (
          <span className="text-xs font-semibold text-[var(--color-ink)]">
            {label}
          </span>
        ) : null}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            fieldBase,
            error && 'border-[var(--color-danger)]',
            className,
          )}
          aria-invalid={Boolean(error)}
          {...props}
        />
        {error ? (
          <span className="text-xs text-[var(--color-danger)]">{error}</span>
        ) : hint ? (
          <span className="text-xs text-[var(--color-muted)]">{hint}</span>
        ) : null}
      </label>
    );
  },
);
Input.displayName = 'Input';

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, hint, error, id, ...props }, ref) => {
    const inputId = id || props.name;
    return (
      <label className="block space-y-1.5">
        {label ? (
          <span className="text-xs font-semibold text-[var(--color-ink)]">
            {label}
          </span>
        ) : null}
        <textarea
          ref={ref}
          id={inputId}
          className={cn(
            fieldBase,
            'min-h-[100px] resize-y',
            error && 'border-[var(--color-danger)]',
            className,
          )}
          aria-invalid={Boolean(error)}
          {...props}
        />
        {error ? (
          <span className="text-xs text-[var(--color-danger)]">{error}</span>
        ) : hint ? (
          <span className="text-xs text-[var(--color-muted)]">{hint}</span>
        ) : null}
      </label>
    );
  },
);
Textarea.displayName = 'Textarea';

export interface SelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  hint?: string;
  error?: string;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  (
    { className, label, hint, error, id, options, placeholder, ...props },
    ref,
  ) => {
    const inputId = id || props.name;
    return (
      <label className="block space-y-1.5">
        {label ? (
          <span className="text-xs font-semibold text-[var(--color-ink)]">
            {label}
          </span>
        ) : null}
        <select
          ref={ref}
          id={inputId}
          className={cn(
            fieldBase,
            error && 'border-[var(--color-danger)]',
            className,
          )}
          aria-invalid={Boolean(error)}
          {...props}
        >
          {placeholder ? (
            <option value="">{placeholder}</option>
          ) : null}
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {error ? (
          <span className="text-xs text-[var(--color-danger)]">{error}</span>
        ) : hint ? (
          <span className="text-xs text-[var(--color-muted)]">{hint}</span>
        ) : null}
      </label>
    );
  },
);
Select.displayName = 'Select';
