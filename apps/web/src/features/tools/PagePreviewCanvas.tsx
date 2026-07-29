'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { ensurePdfWorker } from '@/lib/pdf/pdfHelpers';
import { cn } from '@/lib/utils';
import type { CropRect } from './pageGeometry';

export interface PagePreviewCanvasProps {
  pdfBytes: ArrayBuffer;
  /** 1-based page index */
  pageNumber: number;
  /** Crop rectangle in PDF points (origin bottom-left). */
  cropRect?: CropRect;
  onCropChange?: (rect: CropRect) => void;
  interactive?: boolean;
  className?: string;
  /** Max CSS width for the preview canvas. */
  maxWidth?: number;
}

type Edge = 'L' | 'R' | 'T' | 'B';

interface PageMetrics {
  widthPt: number;
  heightPt: number;
  scale: number;
  canvasW: number;
  canvasH: number;
}

function clampCrop(rect: CropRect, pageW: number, pageH: number): CropRect {
  const minSize = 8;
  let { x, y, w, h } = rect;
  x = Math.max(0, Math.min(x, pageW - minSize));
  y = Math.max(0, Math.min(y, pageH - minSize));
  w = Math.max(minSize, Math.min(w, pageW - x));
  h = Math.max(minSize, Math.min(h, pageH - y));
  return { x, y, w, h };
}

export function PagePreviewCanvas({
  pdfBytes,
  pageNumber,
  cropRect,
  onCropChange,
  interactive = false,
  className,
  maxWidth = 420,
}: PagePreviewCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const docRef = useRef<PDFDocumentProxy | null>(null);
  const [metrics, setMetrics] = useState<PageMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragEdge, setDragEdge] = useState<Edge | null>(null);
  const dragStart = useRef<{ edge: Edge; rect: CropRect; clientX: number; clientY: number } | null>(
    null
  );

  // Load + render page
  useEffect(() => {
    let cancelled = false;
    let doc: PDFDocumentProxy | null = null;

    (async () => {
      setError(null);
      try {
        const pdfjs = await import('pdfjs-dist');
        ensurePdfWorker(pdfjs);
        const task = pdfjs.getDocument({
          data: pdfBytes.slice(0),
          isEvalSupported: false,
        });
        doc = await task.promise;
        if (cancelled) {
          await doc.destroy().catch(() => undefined);
          return;
        }
        docRef.current = doc;

        if (pageNumber < 1 || pageNumber > doc.numPages) {
          setError(`Page ${pageNumber} is outside 1–${doc.numPages}.`);
          setMetrics(null);
          return;
        }

        const page = await doc.getPage(pageNumber);
        const base = page.getViewport({ scale: 1 });
        const scale = Math.min(maxWidth / base.width, 2.5);
        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current;
        if (!canvas || cancelled) return;
        canvas.width = Math.max(1, Math.floor(viewport.width));
        canvas.height = Math.max(1, Math.floor(viewport.height));
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas unavailable');
        await page.render({ canvasContext: ctx, viewport, canvas }).promise;
        page.cleanup();
        if (!cancelled) {
          setMetrics({
            widthPt: base.width,
            heightPt: base.height,
            scale,
            canvasW: canvas.width,
            canvasH: canvas.height,
          });
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to render page');
          setMetrics(null);
        }
      }
    })();

    return () => {
      cancelled = true;
      const d = docRef.current;
      docRef.current = null;
      if (d) void d.destroy().catch(() => undefined);
    };
  }, [pdfBytes, pageNumber, maxWidth]);

  const ptToCss = useCallback(
    (rect: CropRect) => {
      if (!metrics) return null;
      // PDF y is bottom-left; CSS y is top-left
      const left = rect.x * metrics.scale;
      const width = rect.w * metrics.scale;
      const height = rect.h * metrics.scale;
      const top = (metrics.heightPt - rect.y - rect.h) * metrics.scale;
      return { left, top, width, height };
    },
    [metrics]
  );

  const updateFromClientDelta = useCallback(
    (clientX: number, clientY: number) => {
      if (!dragStart.current || !metrics || !onCropChange) return;
      const { edge, rect, clientX: sx, clientY: sy } = dragStart.current;
      const dx = (clientX - sx) / metrics.scale;
      const dyCss = (clientY - sy) / metrics.scale;
      // CSS down → PDF y decreases
      const dy = -dyCss;
      let next = { ...rect };
      if (edge === 'L') {
        const nx = Math.min(rect.x + dx, rect.x + rect.w - 8);
        next.w = rect.w + (rect.x - nx);
        next.x = Math.max(0, nx);
        if (next.x === 0) next.w = rect.x + rect.w;
      } else if (edge === 'R') {
        next.w = Math.max(8, Math.min(rect.w + dx, metrics.widthPt - rect.x));
      } else if (edge === 'B') {
        const ny = Math.min(rect.y + dy, rect.y + rect.h - 8);
        next.h = rect.h + (rect.y - ny);
        next.y = Math.max(0, ny);
        if (next.y === 0) next.h = rect.y + rect.h;
      } else if (edge === 'T') {
        next.h = Math.max(8, Math.min(rect.h + dy, metrics.heightPt - rect.y));
      }
      onCropChange(clampCrop(next, metrics.widthPt, metrics.heightPt));
    },
    [metrics, onCropChange]
  );

  useEffect(() => {
    if (!dragEdge) return;
    const onMove = (e: PointerEvent) => updateFromClientDelta(e.clientX, e.clientY);
    const onUp = () => {
      setDragEdge(null);
      dragStart.current = null;
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [dragEdge, updateFromClientDelta]);

  const startDrag = (edge: Edge, e: React.PointerEvent) => {
    if (!interactive || !cropRect || !onCropChange) return;
    e.preventDefault();
    e.stopPropagation();
    dragStart.current = {
      edge,
      rect: { ...cropRect },
      clientX: e.clientX,
      clientY: e.clientY,
    };
    setDragEdge(edge);
  };

  const cssRect = cropRect && metrics ? ptToCss(cropRect) : null;

  return (
    <div
      ref={wrapRef}
      className={cn(
        'relative inline-block max-w-full overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)]',
        className
      )}
    >
      <canvas ref={canvasRef} className="block max-w-full h-auto" aria-label="PDF page preview" />
      {cssRect && metrics ? (
        <>
          {/* Dim outside crop (four panels) */}
          <div
            className="pointer-events-none absolute bg-black/40"
            style={{ left: 0, top: 0, width: metrics.canvasW, height: cssRect.top }}
            aria-hidden
          />
          <div
            className="pointer-events-none absolute bg-black/40"
            style={{
              left: 0,
              top: cssRect.top + cssRect.height,
              width: metrics.canvasW,
              height: Math.max(0, metrics.canvasH - cssRect.top - cssRect.height),
            }}
            aria-hidden
          />
          <div
            className="pointer-events-none absolute bg-black/40"
            style={{
              left: 0,
              top: cssRect.top,
              width: cssRect.left,
              height: cssRect.height,
            }}
            aria-hidden
          />
          <div
            className="pointer-events-none absolute bg-black/40"
            style={{
              left: cssRect.left + cssRect.width,
              top: cssRect.top,
              width: Math.max(0, metrics.canvasW - cssRect.left - cssRect.width),
              height: cssRect.height,
            }}
            aria-hidden
          />
          <div
            className="pointer-events-none absolute border-2 border-[var(--color-accent)]"
            style={{
              left: cssRect.left,
              top: cssRect.top,
              width: cssRect.width,
              height: cssRect.height,
            }}
          />
          {interactive && onCropChange
            ? (['L', 'R', 'T', 'B'] as Edge[]).map((edge) => {
                const style: React.CSSProperties =
                  edge === 'L'
                    ? {
                        left: cssRect.left - 6,
                        top: cssRect.top + cssRect.height / 2 - 14,
                        width: 12,
                        height: 28,
                        cursor: 'ew-resize',
                      }
                    : edge === 'R'
                      ? {
                          left: cssRect.left + cssRect.width - 6,
                          top: cssRect.top + cssRect.height / 2 - 14,
                          width: 12,
                          height: 28,
                          cursor: 'ew-resize',
                        }
                      : edge === 'T'
                        ? {
                            left: cssRect.left + cssRect.width / 2 - 14,
                            top: cssRect.top - 6,
                            width: 28,
                            height: 12,
                            cursor: 'ns-resize',
                          }
                        : {
                            left: cssRect.left + cssRect.width / 2 - 14,
                            top: cssRect.top + cssRect.height - 6,
                            width: 28,
                            height: 12,
                            cursor: 'ns-resize',
                          };
                return (
                  <button
                    key={edge}
                    type="button"
                    aria-label={`Resize crop ${edge === 'L' ? 'left' : edge === 'R' ? 'right' : edge === 'T' ? 'top' : 'bottom'}`}
                    className="absolute z-10 touch-none rounded-sm border border-[var(--color-accent)] bg-[var(--color-surface)] shadow-sm"
                    style={style}
                    onPointerDown={(e) => startDrag(edge, e)}
                  />
                );
              })
            : null}
        </>
      ) : null}
      {error ? (
        <p className="absolute inset-x-0 bottom-0 bg-[var(--color-danger)]/90 p-2 text-xs text-white">
          {error}
        </p>
      ) : null}
    </div>
  );
}
