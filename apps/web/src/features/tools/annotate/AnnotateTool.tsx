'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '@/shared/ui/Button';
import { downloadBlobLocally } from '@/features/files/localDownload';
import { ToolWorkbench, type ToolFile } from '../ToolWorkbench';
import { loadReadablePdf } from '../assertPdfReadable';
import { flattenOverlays } from '../overlays/flattenOverlays';
import {
  createId,
  type HighlightOverlay,
  type OverlayItem,
  type PageCommentOverlay,
  type StickyNoteOverlay,
} from '../overlays/types';

type AnnotateMode = 'highlight' | 'stickyNote' | 'pageComment';

const HIGHLIGHT_COLORS = ['#facc15', '#86efac', '#93c5fd', '#f9a8d4'] as const;

export function AnnotateTool() {
  const [files, setFiles] = useState<ToolFile[]>([]);
  const [pageCount, setPageCount] = useState(0);
  const [pageSizes, setPageSizes] = useState<Array<{ w: number; h: number }>>([]);
  const [overlays, setOverlays] = useState<OverlayItem[]>([]);
  const [activePage, setActivePage] = useState(1);
  const [tool, setTool] = useState<AnnotateMode>('highlight');
  const [highlightColor, setHighlightColor] = useState<string>(HIGHLIGHT_COLORS[0]);
  const [noteText, setNoteText] = useState('');
  const [noteAuthor, setNoteAuthor] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);

  const file = files[0]?.file;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!file) {
        setPageCount(0);
        setOverlays([]);
        setPageSizes([]);
        return;
      }
      try {
        const buf = await file.arrayBuffer();
        const doc = await loadReadablePdf(buf);
        if (cancelled) return;
        const n = doc.getPageCount();
        setPageCount(n);
        setPageSizes(
          doc
            .getPages()
            .map((p) => p.getSize())
            .map((s) => ({ w: s.width, h: s.height }))
        );
        setActivePage(1);
        setOverlays([]);
        setError(null);
        setProgress(null);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not read PDF');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [file]);

  const pageSize = pageSizes[activePage - 1] || { w: 595, h: 842 };

  const pageAnnotations = useMemo(
    () =>
      overlays.filter(
        (o) =>
          (o.kind === 'highlight' ||
            o.kind === 'stickyNote' ||
            o.kind === 'pageComment') &&
          o.page === activePage
      ),
    [overlays, activePage]
  );

  const addHighlight = () => {
    const item: HighlightOverlay = {
      id: createId(),
      kind: 'highlight',
      page: activePage,
      x: pageSize.w * 0.15,
      y: pageSize.h * 0.55,
      width: pageSize.w * 0.5,
      height: 18,
      rotation: 0,
      opacity: 1,
      color: highlightColor,
    };
    setOverlays((prev) => [...prev, item]);
  };

  const addSticky = () => {
    const text = noteText.trim() || 'Sticky note';
    const item: StickyNoteOverlay = {
      id: createId(),
      kind: 'stickyNote',
      page: activePage,
      x: 48,
      y: pageSize.h - 80,
      width: 160,
      height: 24,
      rotation: 0,
      opacity: 1,
      text,
      color: '#facc15',
      author: noteAuthor.trim() || undefined,
    };
    setOverlays((prev) => [...prev, item]);
    setNoteText('');
  };

  const addComment = () => {
    const text = noteText.trim() || 'Page comment';
    const item: PageCommentOverlay = {
      id: createId(),
      kind: 'pageComment',
      page: activePage,
      x: 40,
      y: 40,
      width: 280,
      height: 40,
      rotation: 0,
      opacity: 1,
      text,
    };
    setOverlays((prev) => [...prev, item]);
    setNoteText('');
  };

  const updateText = (id: string, text: string) => {
    setOverlays((prev) =>
      prev.map((o) => {
        if (o.id !== id) return o;
        if (o.kind === 'stickyNote' || o.kind === 'pageComment') {
          return { ...o, text };
        }
        return o;
      })
    );
  };

  const removeItem = (id: string) => {
    setOverlays((prev) => prev.filter((o) => o.id !== id));
  };

  const exportFlattened = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    setProgress('Flattening annotations into content…');
    try {
      const bytes = await file.arrayBuffer();
      const out = await flattenOverlays(bytes, overlays, (c, t) =>
        setProgress(`Flattening page ${Math.min(c + 1, t)} / ${t}`)
      );
      const name = file.name.replace(/\.pdf$/i, '') + '-annotated.pdf';
      downloadBlobLocally(new Blob([out], { type: 'application/pdf' }), name);
      setProgress('Downloaded (flattened into content)');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setProgress(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ToolWorkbench
      title="Annotate PDF"
      description="Add highlights, sticky notes, and page comments, then flatten them into the PDF content."
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
          disabled={!file || busy || overlays.length === 0}
          loading={busy}
          onClick={() => void exportFlattened()}
        >
          Flatten into content & download
        </Button>
      }
    >
      <div className="space-y-4">
        <p className="text-xs text-[var(--color-muted)]">
          Mode: <strong className="text-[var(--color-ink)]">Flatten into content</strong>{' '}
          (Phase 2 — annotations become part of the page drawing).
        </p>

        {pageCount > 0 ? (
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-sm text-[var(--color-ink)]">
              Page{' '}
              <select
                className="ml-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1.5 text-sm"
                value={activePage}
                onChange={(e) => setActivePage(Number(e.target.value))}
              >
                {Array.from({ length: pageCount }, (_, i) => i + 1).map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>
            <span className="text-xs text-[var(--color-muted)]">
              {Math.round(pageSize.w)} × {Math.round(pageSize.h)} pt
            </span>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2" role="group" aria-label="Annotation tools">
          {(
            [
              ['highlight', 'Area highlight'],
              ['stickyNote', 'Sticky note'],
              ['pageComment', 'Page comment'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTool(id)}
              className={
                tool === id
                  ? 'rounded-lg bg-[var(--color-accent)] px-3 py-1.5 text-xs font-semibold text-white'
                  : 'rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-medium text-[var(--color-ink)]'
              }
            >
              {label}
            </button>
          ))}
        </div>

        {tool === 'highlight' ? (
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex gap-1.5" role="group" aria-label="Highlight color">
              {HIGHLIGHT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  title={c}
                  aria-label={`Color ${c}`}
                  onClick={() => setHighlightColor(c)}
                  className="h-7 w-7 rounded-md border-2"
                  style={{
                    background: c,
                    borderColor: highlightColor === c ? 'var(--color-ink)' : 'transparent',
                  }}
                />
              ))}
            </div>
            <Button variant="secondary" size="sm" disabled={!file} onClick={addHighlight}>
              Add highlight on page {activePage}
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {tool === 'stickyNote' ? (
              <label className="block text-sm text-[var(--color-muted)]">
                Author (optional)
                <input
                  type="text"
                  value={noteAuthor}
                  onChange={(e) => setNoteAuthor(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-ink)]"
                  placeholder="Your name"
                />
              </label>
            ) : null}
            <label className="block text-sm text-[var(--color-muted)]">
              Text
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                rows={2}
                className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-ink)]"
                placeholder={tool === 'stickyNote' ? 'Sticky note…' : 'Page comment…'}
              />
            </label>
            <Button
              variant="secondary"
              size="sm"
              disabled={!file}
              onClick={tool === 'stickyNote' ? addSticky : addComment}
            >
              {tool === 'stickyNote' ? 'Add sticky note' : 'Add page comment'}
            </Button>
          </div>
        )}

        <aside
          className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)]/40 p-3"
          aria-label="Annotations on this page"
        >
          <h3 className="text-sm font-semibold text-[var(--color-ink)]">
            Page {activePage} annotations ({pageAnnotations.length})
          </h3>
          {pageAnnotations.length === 0 ? (
            <p className="mt-2 text-xs text-[var(--color-muted)]">No annotations on this page.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {pageAnnotations.map((item) => (
                <li
                  key={item.id}
                  className="flex flex-col gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-2 sm:flex-row sm:items-start"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold uppercase tracking-wide text-[var(--color-muted)]">
                      {item.kind}
                      {item.kind === 'highlight' ? (
                        <span
                          className="ml-2 inline-block h-2.5 w-2.5 rounded-sm align-middle"
                          style={{ background: item.color }}
                        />
                      ) : null}
                    </p>
                    {item.kind === 'stickyNote' || item.kind === 'pageComment' ? (
                      <input
                        type="text"
                        value={item.text}
                        onChange={(e) => updateText(item.id, e.target.value)}
                        className="mt-1 w-full rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-sm"
                        aria-label={`Edit ${item.kind} text`}
                      />
                    ) : (
                      <p className="mt-1 text-xs text-[var(--color-muted)]">
                        Area {Math.round(item.width)}×{Math.round(item.height)} pt
                      </p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeItem(item.id)}
                    aria-label="Delete annotation"
                  >
                    Delete
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        {error ? (
          <p className="text-sm text-[var(--color-danger)]" role="alert">
            {error}
          </p>
        ) : null}
        {progress ? (
          <p className="text-sm text-[var(--color-muted)]" aria-live="polite">
            {progress}
          </p>
        ) : null}
      </div>
    </ToolWorkbench>
  );
}
