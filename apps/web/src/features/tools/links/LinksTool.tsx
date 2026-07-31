'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/shared/ui/Button';
import { downloadBlobLocally, uint8ToBlob } from '@/features/files/localDownload';
import { ToolWorkbench, type ToolFile } from '../ToolWorkbench';
import { ToolError } from '../ToolError';
import { ToolProgress } from '../ToolProgress';
import { useTimedProgress } from '../useTimedProgress';
import { loadReadablePdf } from '../assertPdfReadable';
import { createId, type LinkOverlay } from '../overlays/types';
import { assertAllowedLinkUri, isAllowedLinkUri } from '../overlays/linkUri';
import { extractLinkAnnotations } from '../overlays/extractLinkAnnotations';
import { writeLinkAnnotationsOnly } from '../overlays/writeLinkAnnotationsOnly';

export function LinksTool() {
  const [files, setFiles] = useState<ToolFile[]>([]);
  const [pageCount, setPageCount] = useState(0);
  const [overlays, setOverlays] = useState<LinkOverlay[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const cancelledRef = useRef(false);
  const { elapsedLabel } = useTimedProgress(busy);

  const [uri, setUri] = useState('https://');
  const [page, setPage] = useState(1);
  const [x, setX] = useState(72);
  const [y, setY] = useState(720);
  const [width, setWidth] = useState(160);
  const [height, setHeight] = useState(18);

  const file = files[0]?.file;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!file) {
        setPageCount(0);
        setOverlays([]);
        return;
      }
      try {
        const buf = await file.arrayBuffer();
        const doc = await loadReadablePdf(buf);
        if (cancelled) return;
        const n = doc.getPageCount();
        setPageCount(n);
        setPage(1);
        setError(null);
        setProgress(null);
        
        // Extract existing links
        const existing = await extractLinkAnnotations(buf);
        if (cancelled) return;
        setOverlays(existing);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not read PDF');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [file]);

  const links = useMemo(() => overlays, [overlays]);

  const addLink = () => {
    const trimmed = uri.trim();
    if (!trimmed) {
      setError('URI is required.');
      return;
    }
    if (!isAllowedLinkUri(trimmed)) {
      setError('URI must use http:, https:, or mailto: only.');
      return;
    }
    if (pageCount > 0 && (page < 1 || page > pageCount)) {
      setError(`Page must be between 1 and ${pageCount}.`);
      return;
    }
    if (!(width > 0) || !(height > 0)) {
      setError('Width and height must be positive.');
      return;
    }
    const item: LinkOverlay = {
      id: createId(),
      kind: 'link',
      page,
      x,
      y,
      width,
      height,
      rotation: 0,
      opacity: 1,
      uri: assertAllowedLinkUri(trimmed),
      source: 'new',
    };
    setOverlays((prev) => [...prev, item]);
    setError(null);
  };

  const updateLink = (id: string, patch: Partial<LinkOverlay>) => {
    // Always apply keystrokes (including intermediate invalid URIs); validate on blur/export.
    setOverlays((prev) =>
      prev.map((l) => (l.id === id ? { ...l, ...patch } : l))
    );
    setError(null);
  };

  const validateLinkUri = (id: string) => {
    const item = overlays.find((l) => l.id === id);
    if (!item) return;
    if (!isAllowedLinkUri(item.uri)) {
      setError('URI must use http:, https:, or mailto: only.');
      return;
    }
    try {
      const normalized = assertAllowedLinkUri(item.uri);
      if (normalized !== item.uri) {
        setOverlays((prev) =>
          prev.map((l) => (l.id === id ? { ...l, uri: normalized } : l))
        );
      }
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const removeLink = (id: string) => {
    setOverlays((prev) => prev.filter((l) => l.id !== id));
  };

  const exportWithLinks = async () => {
    if (!file) return;
    cancelledRef.current = false;
    setBusy(true);
    setError(null);
    setProgress(
      overlays.length
        ? 'Writing link annotations…'
        : 'Stripping link annotations…'
    );
    try {
      for (const link of overlays) {
        assertAllowedLinkUri(link.uri);
      }
      const bytes = await file.arrayBuffer();
      if (cancelledRef.current) {
        setProgress(null);
        return;
      }
      const out = await writeLinkAnnotationsOnly({
        bytes,
        links: overlays,
        onProgress: (c, t) => {
          if (cancelledRef.current) throw new Error('Cancelled');
          setProgress(
            overlays.length
              ? `Writing link ${Math.min(c, t)} / ${t}`
              : 'Saving without links…'
          );
        },
      });
      if (cancelledRef.current) {
        setProgress(null);
        return;
      }
      const name = file.name.replace(/\.pdf$/i, '') + '-links.pdf';
      downloadBlobLocally(uint8ToBlob(out, 'application/pdf'), name);
      setProgress(
        overlays.length
          ? 'Downloaded with link annotations'
          : 'Downloaded (all links removed)'
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg === 'Cancelled' || cancelledRef.current) {
        setProgress(null);
        setError(null);
      } else {
        setError(msg);
        setProgress(null);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <ToolWorkbench
      title="Edit PDF links"
      description="Add and edit clickable URI link annotations. Existing links are extracted and can be edited or removed."
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
          disabled={!file || busy}
          loading={busy}
          onClick={() => void exportWithLinks()}
        >
          {overlays.length === 0 ? 'Export (remove all links)' : 'Export with links'}
        </Button>
      }
    >
      <div className="space-y-4">
        <p className="text-xs text-[var(--color-muted)]">
          Coordinates use PDF points with origin at the bottom-left of the page.
        </p>

        <fieldset className="grid gap-3 rounded-xl border border-[var(--color-border)] p-3 sm:grid-cols-2">
          <legend className="px-1 text-sm font-semibold text-[var(--color-ink)]">
            Add link
          </legend>
          <label className="block text-sm text-[var(--color-muted)] sm:col-span-2">
            URI
            <input
              type="url"
              value={uri}
              onChange={(e) => setUri(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-ink)]"
              placeholder="https://example.com"
            />
          </label>
          <label className="block text-sm text-[var(--color-muted)]">
            Page
            <input
              type="number"
              min={1}
              max={pageCount || undefined}
              value={page}
              onChange={(e) => setPage(Number(e.target.value) || 1)}
              className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm"
            />
          </label>
          <div className="grid grid-cols-2 gap-2 sm:col-span-1">
            <label className="block text-sm text-[var(--color-muted)]">
              X
              <input
                type="number"
                value={x}
                onChange={(e) => setX(Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-sm text-[var(--color-muted)]">
              Y
              <input
                type="number"
                value={y}
                onChange={(e) => setY(Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-sm text-[var(--color-muted)]">
              Width
              <input
                type="number"
                value={width}
                onChange={(e) => setWidth(Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-sm text-[var(--color-muted)]">
              Height
              <input
                type="number"
                value={height}
                onChange={(e) => setHeight(Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm"
              />
            </label>
          </div>
          <div className="sm:col-span-2">
            <Button variant="secondary" size="sm" disabled={!file} onClick={addLink}>
              Add link
            </Button>
          </div>
        </fieldset>

        <aside
          className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)]/40 p-3"
          aria-label="Links list"
        >
          <h3 className="text-sm font-semibold text-[var(--color-ink)]">
            Links ({links.length})
          </h3>
          {links.length === 0 ? (
            <p className="mt-2 text-xs text-[var(--color-muted)]">
              No links found or added yet.
            </p>
          ) : (
            <ul className="mt-2 space-y-2">
              {links.map((item) => (
                <li
                  key={item.id}
                  className="space-y-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-2"
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="url"
                      value={item.uri}
                      onChange={(e) => updateLink(item.id, { uri: e.target.value })}
                      onBlur={() => validateLinkUri(item.id)}
                      className="flex-1 rounded border border-[var(--color-border)] px-2 py-1 text-sm"
                      aria-label="Link URI"
                    />
                    <span
                      className={
                        item.source === 'existing'
                          ? 'rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                          : 'rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900 dark:text-green-200'
                      }
                    >
                      {item.source === 'existing' ? 'Existing' : 'New'}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <label>
                      Page{' '}
                      <input
                        type="number"
                        value={item.page}
                        onChange={(e) =>
                          updateLink(item.id, { page: Number(e.target.value) || 1 })
                        }
                        className="w-14 rounded border border-[var(--color-border)] px-1 py-0.5"
                      />
                    </label>
                    <label>
                      X{' '}
                      <input
                        type="number"
                        value={item.x}
                        onChange={(e) =>
                          updateLink(item.id, { x: Number(e.target.value) })
                        }
                        className="w-16 rounded border border-[var(--color-border)] px-1 py-0.5"
                      />
                    </label>
                    <label>
                      Y{' '}
                      <input
                        type="number"
                        value={item.y}
                        onChange={(e) =>
                          updateLink(item.id, { y: Number(e.target.value) })
                        }
                        className="w-16 rounded border border-[var(--color-border)] px-1 py-0.5"
                      />
                    </label>
                    <label>
                      W{' '}
                      <input
                        type="number"
                        value={item.width}
                        onChange={(e) =>
                          updateLink(item.id, { width: Number(e.target.value) })
                        }
                        className="w-16 rounded border border-[var(--color-border)] px-1 py-0.5"
                      />
                    </label>
                    <label>
                      H{' '}
                      <input
                        type="number"
                        value={item.height}
                        onChange={(e) =>
                          updateLink(item.id, { height: Number(e.target.value) })
                        }
                        className="w-16 rounded border border-[var(--color-border)] px-1 py-0.5"
                      />
                    </label>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeLink(item.id)}
                      aria-label="Delete link"
                    >
                      Delete
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </aside>

        {error ? (
        <ToolError message={error} fileName={file?.name} onRetry={() => { setError(null); void exportWithLinks(); }} />
      ) : null}
        {busy && progress ? (
          <ToolProgress
            stage={progress}
            elapsedLabel={elapsedLabel}
            onCancel={() => {
              cancelledRef.current = true;
              setProgress('Cancelling after current page…');
            }}
          />
        ) : progress && !busy ? (
          <p className="text-sm text-[var(--color-muted)]" aria-live="polite">
            {progress}
          </p>
        ) : null}
        <p className="text-xs text-[var(--color-muted)]">
          Cancel finishes the current page, then stops (no mid-step abort).
        </p>
      </div>
    </ToolWorkbench>
  );
}
