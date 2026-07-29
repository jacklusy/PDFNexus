'use client';

import React, { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/shared/ui/Button';
import { downloadBlobLocally } from '@/features/files/localDownload';
import { ToolWorkbench, type ToolFile } from '../ToolWorkbench';
import { loadReadablePdf } from '../assertPdfReadable';
import {
  REDACT_WARNING,
  redactPdf,
  verifyRedaction,
  type RedactRegion,
  type VerifyMatch,
} from './redactPdf';

function makeId() {
  return Math.random().toString(36).slice(2, 10);
}

export function RedactTool() {
  const [files, setFiles] = useState<ToolFile[]>([]);
  const [pageCount, setPageCount] = useState(0);
  const [regions, setRegions] = useState<(RedactRegion & { id: string })[]>([]);
  const [page, setPage] = useState(1);
  const [x, setX] = useState(72);
  const [y, setY] = useState(700);
  const [w, setW] = useState(160);
  const [h, setH] = useState(20);
  const [phrases, setPhrases] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [matches, setMatches] = useState<VerifyMatch[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);

  const file = files[0]?.file;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!file) {
        setPageCount(0);
        setRegions([]);
        setMatches(null);
        return;
      }
      try {
        const buf = await file.arrayBuffer();
        const doc = await loadReadablePdf(buf);
        if (!cancelled) {
          setPageCount(doc.getPageCount());
          setPage(1);
          setRegions([]);
          setMatches(null);
          setConfirmed(false);
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

  const addRegion = () => {
    if (pageCount > 0 && (page < 1 || page > pageCount)) {
      setError(`Page must be between 1 and ${pageCount}.`);
      return;
    }
    if (!(w > 0) || !(h > 0)) {
      setError('Width and height must be positive.');
      return;
    }
    setRegions((prev) => [...prev, { id: makeId(), page, x, y, w, h }]);
    setError(null);
  };

  const removeRegion = (id: string) => {
    setRegions((prev) => prev.filter((r) => r.id !== id));
  };

  const apply = async () => {
    if (!file || !confirmed || regions.length === 0) return;
    setBusy(true);
    setError(null);
    setMatches(null);
    setProgress('Rebuilding pages (permanent redaction)…');
    try {
      const bytes = await file.arrayBuffer();
      const out = await redactPdf({
        bytes,
        regions: regions.map(({ id: _id, ...r }) => r),
        onProgress: (c, t) => setProgress(`Redacting page ${Math.min(c + 1, t)} / ${t}`),
      });
      const phraseList = phrases
        .split(/[\n,]/)
        .map((p) => p.trim())
        .filter(Boolean);
      setProgress('Verifying text layer…');
      const remaining = await verifyRedaction(out, phraseList);
      setMatches(remaining);

      const name = file.name.replace(/\.pdf$/i, '') + '-redacted.pdf';
      downloadBlobLocally(new Blob([out], { type: 'application/pdf' }), name);
      setProgress(
        remaining.length
          ? `Downloaded. Warning: ${remaining.length} phrase match(es) still found in text.`
          : phraseList.length
            ? 'Downloaded. Verification found no remaining phrase matches.'
            : 'Downloaded. Add phrases above to verify content is gone.'
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setProgress(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ToolWorkbench
      title="Redact PDF"
      description="Permanently destroy content in marked regions by rebuilding pages as images — not a black overlay."
      files={files}
      onFilesChange={(next) => {
        setFiles(next);
        setConfirmed(false);
        setMatches(null);
        setError(null);
        setProgress(null);
      }}
      busy={busy}
      footer={
        <Button
          variant="primary"
          disabled={!file || busy || !confirmed || regions.length === 0}
          loading={busy}
          onClick={() => void apply()}
        >
          Redact & download
        </Button>
      }
    >
      <div
        className="flex gap-3 rounded-xl border border-[var(--color-danger)]/40 bg-[var(--color-danger)]/5 p-4"
        role="alert"
      >
        <AlertTriangle
          className="mt-0.5 h-5 w-5 shrink-0 text-[var(--color-danger)]"
          aria-hidden
        />
        <div className="space-y-2 text-sm">
          <p className="font-semibold text-[var(--color-ink)]">Permanent redaction</p>
          <p className="text-[var(--color-muted)]">{REDACT_WARNING}</p>
        </div>
      </div>

      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          className="mt-1"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
          disabled={busy || !file}
        />
        <span>
          I understand this permanently destroys content in the selected regions and
          cannot be undone.
        </span>
      </label>

      <p className="text-xs text-[var(--color-muted)]">
        Region coordinates use PDF points (origin bottom-left).
      </p>

      <fieldset className="grid gap-3 rounded-xl border border-[var(--color-border)] p-3 sm:grid-cols-2">
        <legend className="px-1 text-sm font-semibold">Add region</legend>
        <label className="text-sm">
          Page
          <input
            type="number"
            min={1}
            max={pageCount || undefined}
            className="mt-1 w-full rounded-lg border border-[var(--color-border)] px-3 py-2"
            value={page}
            onChange={(e) => setPage(Number(e.target.value) || 1)}
            disabled={busy}
          />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-sm">
            X
            <input
              type="number"
              className="mt-1 w-full rounded-lg border px-3 py-2"
              value={x}
              onChange={(e) => setX(Number(e.target.value))}
              disabled={busy}
            />
          </label>
          <label className="text-sm">
            Y
            <input
              type="number"
              className="mt-1 w-full rounded-lg border px-3 py-2"
              value={y}
              onChange={(e) => setY(Number(e.target.value))}
              disabled={busy}
            />
          </label>
          <label className="text-sm">
            W
            <input
              type="number"
              className="mt-1 w-full rounded-lg border px-3 py-2"
              value={w}
              onChange={(e) => setW(Number(e.target.value))}
              disabled={busy}
            />
          </label>
          <label className="text-sm">
            H
            <input
              type="number"
              className="mt-1 w-full rounded-lg border px-3 py-2"
              value={h}
              onChange={(e) => setH(Number(e.target.value))}
              disabled={busy}
            />
          </label>
        </div>
        <div className="sm:col-span-2">
          <Button type="button" variant="outline" size="sm" onClick={addRegion} disabled={busy || !file}>
            Add region
          </Button>
        </div>
      </fieldset>

      {regions.length > 0 ? (
        <ul className="space-y-2" aria-label="Redaction regions">
          {regions.map((r) => (
            <li
              key={r.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm"
            >
              <span>
                Page {r.page} · ({r.x},{r.y}) {r.w}×{r.h}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeRegion(r.id)}
                disabled={busy}
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
      ) : null}

      <label className="block text-sm">
        Phrases to verify after redaction (comma or newline separated)
        <textarea
          className="mt-1 w-full rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm"
          rows={3}
          value={phrases}
          onChange={(e) => setPhrases(e.target.value)}
          disabled={busy}
          placeholder="confidential, SSN, …"
        />
      </label>

      {matches ? (
        <div className="rounded-xl border border-[var(--color-border)] p-3 text-sm">
          <p className="font-semibold text-[var(--color-ink)]">Verification</p>
          {matches.length === 0 ? (
            <p className="mt-1 text-[var(--color-muted)]">
              No remaining matches for the listed phrases.
            </p>
          ) : (
            <ul className="mt-2 space-y-1 text-[var(--color-danger)]">
              {matches.map((m, i) => (
                <li key={`${m.page}-${m.phrase}-${i}`}>
                  Page {m.page}: “{m.phrase}” — …{m.snippet}…
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      {progress ? <p className="text-sm text-[var(--color-muted)]">{progress}</p> : null}
      {error ? (
        <p className="text-sm text-[var(--color-danger)]" role="alert">
          {error}
        </p>
      ) : null}
    </ToolWorkbench>
  );
}
