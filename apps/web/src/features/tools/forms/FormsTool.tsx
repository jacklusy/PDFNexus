'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/shared/ui/Button';
import { downloadBlobLocally } from '@/features/files/localDownload';
import { ToolWorkbench } from '../ToolWorkbench';
import { ToolError } from '../ToolError';
import { ToolProgress } from '../ToolProgress';
import { useTimedProgress } from '../useTimedProgress';
import { useToolHandoff } from '../useToolHandoff';
import { loadReadablePdf } from '../assertPdfReadable';
import {
  createFormFields,
  type FormFieldSpec,
  type FormFieldType,
} from './createFormFields';

function makeId() {
  return Math.random().toString(36).slice(2, 10);
}

export function FormsTool() {
  const { files, setFiles } = useToolHandoff();
  const [pageCount, setPageCount] = useState(0);
  const [fields, setFields] = useState<(FormFieldSpec & { id: string })[]>([]);
  const [type, setType] = useState<FormFieldType>('text');
  const [name, setName] = useState('field1');
  const [page, setPage] = useState(1);
  const [x, setX] = useState(72);
  const [y, setY] = useState(700);
  const [w, setW] = useState(200);
  const [h, setH] = useState(24);
  const [required, setRequired] = useState(false);
  const [optionsText, setOptionsText] = useState('Option A, Option B');
  const [label, setLabel] = useState('Submit');
  const [tooltip, setTooltip] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const cancelledRef = useRef(false);
  const { elapsedLabel } = useTimedProgress(busy);

  const file = files[0]?.file;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!file) {
        setPageCount(0);
        setFields([]);
        return;
      }
      try {
        const buf = await file.arrayBuffer();
        const doc = await loadReadablePdf(buf);
        if (!cancelled) {
          setPageCount(doc.getPageCount());
          setPage(1);
          setFields([]);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not read PDF');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [file]);

  const addField = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Field name is required.');
      return;
    }
    // Validate alphanumeric/underscore; must start with letter or underscore
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(trimmed)) {
      setError(
        'Field name must start with a letter or underscore and use only letters, digits, and underscores.'
      );
      return;
    }
    if (pageCount > 0 && (page < 1 || page > pageCount)) {
      setError(`Page must be between 1 and ${pageCount}.`);
      return;
    }
    if (!(w > 0) || !(h > 0)) {
      setError('Width and height must be positive.');
      return;
    }
    const options =
      type === 'radio' || type === 'dropdown'
        ? optionsText
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        : undefined;
    // Stricter validation for radio/dropdown
    if ((type === 'radio' || type === 'dropdown') && (!options || options.length === 0)) {
      setError(`${type === 'radio' ? 'Radio' : 'Dropdown'} fields require at least one option.`);
      return;
    }
    const spec: FormFieldSpec & { id: string } = {
      id: makeId(),
      type,
      name: trimmed,
      page,
      x,
      y,
      w,
      h,
      required,
      options,
      label: type === 'button' ? label : undefined,
      tooltip: tooltip.trim() || undefined,
    };
    setFields((prev) => [...prev, spec]);
    setName((n) => {
      const m = /^(.+?)(\d+)$/.exec(n);
      if (m) return `${m[1]}${Number(m[2]) + 1}`;
      return `${n}_2`;
    });
    setError(null);
  };

  const removeField = (id: string) => {
    setFields((prev) => prev.filter((f) => f.id !== id));
  };

  const moveFieldUp = (id: string) => {
    setFields((prev) => {
      const idx = prev.findIndex((f) => f.id === id);
      if (idx <= 0) return prev;
      const next = [...prev];
      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
      return next;
    });
  };

  const moveFieldDown = (id: string) => {
    setFields((prev) => {
      const idx = prev.findIndex((f) => f.id === id);
      if (idx < 0 || idx >= prev.length - 1) return prev;
      const next = [...prev];
      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
      return next;
    });
  };

  const exportPdf = async () => {
    if (!file || fields.length === 0) return;
    cancelledRef.current = false;
    setBusy(true);
    setError(null);
    setProgress('Writing form fields…');
    try {
      const bytes = await file.arrayBuffer();
      if (cancelledRef.current) {
        setProgress(null);
        return;
      }
      const out = await createFormFields({
        bytes,
        fields: fields.map(({ id: _id, ...rest }) => rest),
      });
      if (cancelledRef.current) {
        setProgress(null);
        return;
      }
      const outName = file.name.replace(/\.pdf$/i, '') + '-form.pdf';
      downloadBlobLocally(new Blob([out], { type: 'application/pdf' }), outName);
      setProgress(`Downloaded with ${fields.length} field(s)`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setProgress(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ToolWorkbench
      title="Create PDF form"
      description="Add fillable AcroForm fields (text, checkbox, radio, dropdown, button) by page and rectangle."
      files={files}
      onFilesChange={(next) => {
        setFiles(next);
        setError(null);
        setProgress(null);
      }}
      busy={busy}
      footer={
        <Button
          variant="primary"
          disabled={!file || busy || fields.length === 0}
          loading={busy}
          onClick={() => void exportPdf()}
        >
          Export form PDF
        </Button>
      }
    >
      <p className="text-xs text-[var(--color-muted)]">
        Coordinates use PDF points with origin at the bottom-left of the page.
        List order is tab order on export. Date and Signature types create text
        widgets (pdf-lib has no native date/Sig creators) — fillable placeholders,
        not Acrobat date/signature field semantics.
      </p>

      <fieldset className="grid gap-3 rounded-xl border border-[var(--color-border)] p-3 sm:grid-cols-2">
        <legend className="px-1 text-sm font-semibold text-[var(--color-ink)]">
          Add field
        </legend>
        <label className="block text-sm text-[var(--color-muted)]">
          Type
          <select
            className="mt-1 w-full rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm"
            value={type}
            onChange={(e) => setType(e.target.value as FormFieldType)}
            disabled={busy}
          >
            <option value="text">Text</option>
            <option value="date">Date (text YYYY-MM-DD)</option>
            <option value="checkbox">Checkbox</option>
            <option value="radio">Radio group</option>
            <option value="dropdown">Dropdown</option>
            <option value="button">Button</option>
            <option value="signature">Signature placeholder (text)</option>
          </select>
        </label>
        <label className="block text-sm text-[var(--color-muted)]">
          Name
          <input
            className="mt-1 w-full rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={busy}
          />
        </label>
        <label className="block text-sm text-[var(--color-muted)]">
          Page
          <input
            type="number"
            min={1}
            max={pageCount || undefined}
            className="mt-1 w-full rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm"
            value={page}
            onChange={(e) => setPage(Number(e.target.value) || 1)}
            disabled={busy}
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-[var(--color-muted)]">
          <input
            type="checkbox"
            checked={required}
            onChange={(e) => setRequired(e.target.checked)}
            disabled={busy}
          />
          Required
        </label>
        <label className="block text-sm text-[var(--color-muted)]">
          X
          <input
            type="number"
            className="mt-1 w-full rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm"
            value={x}
            onChange={(e) => setX(Number(e.target.value))}
            disabled={busy}
          />
        </label>
        <label className="block text-sm text-[var(--color-muted)]">
          Y
          <input
            type="number"
            className="mt-1 w-full rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm"
            value={y}
            onChange={(e) => setY(Number(e.target.value))}
            disabled={busy}
          />
        </label>
        <label className="block text-sm text-[var(--color-muted)]">
          Width
          <input
            type="number"
            className="mt-1 w-full rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm"
            value={w}
            onChange={(e) => setW(Number(e.target.value))}
            disabled={busy}
          />
        </label>
        <label className="block text-sm text-[var(--color-muted)]">
          Height
          <input
            type="number"
            className="mt-1 w-full rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm"
            value={h}
            onChange={(e) => setH(Number(e.target.value))}
            disabled={busy}
          />
        </label>
        {type === 'radio' || type === 'dropdown' ? (
          <label className="block text-sm text-[var(--color-muted)] sm:col-span-2">
            Options (comma-separated)
            <input
              className="mt-1 w-full rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm"
              value={optionsText}
              onChange={(e) => setOptionsText(e.target.value)}
              disabled={busy}
            />
          </label>
        ) : null}
        {type === 'button' ? (
          <label className="block text-sm text-[var(--color-muted)] sm:col-span-2">
            Button label
            <input
              className="mt-1 w-full rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              disabled={busy}
            />
          </label>
        ) : null}
        <label className="block text-sm text-[var(--color-muted)] sm:col-span-2">
          Tooltip (optional)
          <input
            className="mt-1 w-full rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm"
            value={tooltip}
            onChange={(e) => setTooltip(e.target.value)}
            disabled={busy}
            placeholder="Hover text for this field"
          />
        </label>
        <div className="sm:col-span-2">
          <Button type="button" variant="outline" size="sm" onClick={addField} disabled={busy || !file}>
            Add to list
          </Button>
        </div>
      </fieldset>

      {fields.length > 0 ? (
        <>
          <p className="text-xs text-[var(--color-muted)]">
            List order determines tab order in the PDF. Use arrows to reorder fields.
          </p>
          <ul className="space-y-2" aria-label="Form fields">
            {fields.map((f, idx) => (
              <li
                key={f.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm"
              >
                <span className="flex-1">
                  <span className="font-medium text-[var(--color-ink)]">{f.name}</span>
                  <span className="ml-2 text-xs text-[var(--color-muted)]">
                    {f.type} · p{f.page} · ({f.x},{f.y}) {f.w}×{f.h}
                    {f.required ? ' · required' : ''}
                  </span>
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => moveFieldUp(f.id)}
                    disabled={busy || idx === 0}
                    aria-label="Move up"
                  >
                    ↑
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => moveFieldDown(f.id)}
                    disabled={busy || idx === fields.length - 1}
                    aria-label="Move down"
                  >
                    ↓
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeField(f.id)}
                    disabled={busy}
                  >
                    Remove
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {busy && progress ? (
        <ToolProgress
          stage={progress}
          elapsedLabel={elapsedLabel}
          onCancel={() => {
            cancelledRef.current = true;
            setProgress('Cancelling after current step…');
          }}
        />
      ) : progress && !busy ? (
        <p className="text-sm text-[var(--color-muted)]">{progress}</p>
      ) : null}
      <p className="text-xs text-[var(--color-muted)]">
        Cancel finishes the current step, then stops (no mid-step abort).
      </p>
      {error ? (
        <ToolError message={error} fileName={file?.name} onRetry={() => { setError(null); void exportPdf(); }} />
      ) : null}
    </ToolWorkbench>
  );
}
