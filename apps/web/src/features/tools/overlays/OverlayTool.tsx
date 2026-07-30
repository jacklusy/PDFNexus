'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/shared/ui/Button';
import { downloadBlobLocally } from '@/features/files/localDownload';
import { ToolWorkbench, type ToolFile } from '../ToolWorkbench';
import { loadReadablePdf } from '../assertPdfReadable';
import { flattenOverlays } from './flattenOverlays';
import {
  WATERMARK_PRESETS,
  createId,
  type OverlayItem,
  type OverlayKind,
  type PageNumberOverlay,
  type SignatureOverlay,
  type TextOverlay,
  type ShapeOverlay,
  type WatermarkOverlay,
  type FreehandOverlay,
} from './types';

export type OverlayToolMode =
  | 'sign'
  | 'edit'
  | 'watermark'
  | 'pageNumbers';

const SIGN_CONSENT_KEY = 'pdfnexus.signature.consent';
const SIGN_SAVE_KEY = 'pdfnexus.signature.saved';

export function OverlayTool({ mode }: { mode: OverlayToolMode }) {
  const [files, setFiles] = useState<ToolFile[]>([]);
  const [pageCount, setPageCount] = useState(0);
  const [pageSizes, setPageSizes] = useState<Array<{ w: number; h: number }>>([]);
  const [overlays, setOverlays] = useState<OverlayItem[]>([]);
  const [activePage, setActivePage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [sigText, setSigText] = useState('');
  const [consent, setConsent] = useState(false);
  const [textValue, setTextValue] = useState('Sample text');
  const [wmText, setWmText] = useState('Confidential');
  const [wmTile, setWmTile] = useState(true);
  const drawRef = useRef<HTMLCanvasElement>(null);
  const freehandRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const freehandPts = useRef<Array<{ x: number; y: number }>>([]);
  const [showFreehandPad, setShowFreehandPad] = useState(false);

  const file = files[0]?.file;
  const titles: Record<OverlayToolMode, string> = {
    sign: 'Sign PDF (electronic stamp)',
    edit: 'Add text & shapes',
    watermark: 'Watermark PDF',
    pageNumbers: 'Page numbers',
  };

  useEffect(() => {
    try {
      setConsent(localStorage.getItem(SIGN_CONSENT_KEY) === '1');
      const saved = localStorage.getItem(SIGN_SAVE_KEY);
      if (saved) setSigText(saved);
    } catch {
      // ignore
    }
  }, []);

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
        setPageSizes(doc.getPages().map((p) => p.getSize()).map((s) => ({ w: s.width, h: s.height })));
        setActivePage(1);
        setError(null);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not read PDF');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [file]);

  const pageSize = pageSizes[activePage - 1] || { w: 595, h: 842 };

  const addSignatureFromDraw = () => {
    const canvas = drawRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    const item: SignatureOverlay = {
      id: createId(),
      kind: 'signature',
      page: activePage,
      x: 72,
      y: 72,
      width: 180,
      height: 60,
      rotation: 0,
      opacity: 1,
      imageDataUrl: dataUrl,
    };
    setOverlays((prev) => [...prev, item]);
  };

  const addTypedSignature = () => {
    if (!sigText.trim()) return;
    const item: SignatureOverlay = {
      id: createId(),
      kind: 'signature',
      page: activePage,
      x: 72,
      y: 100,
      width: 220,
      height: 48,
      rotation: 0,
      opacity: 1,
      text: sigText.trim(),
    };
    setOverlays((prev) => [...prev, item]);
    if (consent) {
      try {
        localStorage.setItem(SIGN_CONSENT_KEY, '1');
        localStorage.setItem(SIGN_SAVE_KEY, sigText.trim());
      } catch {
        // ignore
      }
    }
  };

  const addText = () => {
    const item: TextOverlay = {
      id: createId(),
      kind: 'text',
      page: activePage,
      x: 72,
      y: pageSize.h - 100,
      width: 300,
      height: 24,
      rotation: 0,
      opacity: 1,
      text: textValue,
      fontSize: 14,
      color: '#111827',
    };
    setOverlays((prev) => [...prev, item]);
  };

  const addShape = (kind: Extract<OverlayKind, 'rect' | 'ellipse' | 'line' | 'arrow'>) => {
    const item: ShapeOverlay = {
      id: createId(),
      kind,
      page: activePage,
      x: 100,
      y: pageSize.h / 2,
      width: kind === 'line' || kind === 'arrow' ? 160 : 120,
      height: kind === 'line' || kind === 'arrow' ? 0 : 80,
      rotation: 0,
      opacity: 1,
      stroke: '#0f766e',
      fill: kind === 'rect' || kind === 'ellipse' ? undefined : undefined,
      strokeWidth: 2,
    };
    setOverlays((prev) => [...prev, item]);
  };

  const addCallout = () => {
    const boxX = 72;
    const boxY = pageSize.h - 220;
    const rect: ShapeOverlay = {
      id: createId(),
      kind: 'rect',
      page: activePage,
      x: boxX,
      y: boxY,
      width: 200,
      height: 80,
      rotation: 0,
      opacity: 1,
      stroke: '#b45309',
      fill: '#fffbeb',
      strokeWidth: 1.5,
    };
    const label: TextOverlay = {
      id: createId(),
      kind: 'text',
      page: activePage,
      x: boxX + 10,
      y: boxY + 50,
      width: 180,
      height: 40,
      rotation: 0,
      opacity: 1,
      text: textValue || 'Callout',
      fontSize: 12,
      color: '#78350f',
    };
    setOverlays((prev) => [...prev, rect, label]);
  };

  const placeFreehand = () => {
    const pts = freehandPts.current;
    if (pts.length < 2) {
      setError('Draw a freehand stroke first.');
      return;
    }
    const canvas = freehandRef.current;
    if (!canvas) return;
    // Map canvas coords (top-left origin) into PDF page points (bottom-left).
    const xs = pts.map((p) => (p.x / canvas.width) * pageSize.w);
    const ys = pts.map((p) => pageSize.h - (p.y / canvas.height) * pageSize.h);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const item: FreehandOverlay = {
      id: createId(),
      kind: 'freehand',
      page: activePage,
      x: minX,
      y: minY,
      width: Math.max(1, maxX - minX),
      height: Math.max(1, maxY - minY),
      rotation: 0,
      opacity: 1,
      points: xs.map((x, i) => ({ x, y: ys[i] })),
      stroke: '#111827',
      strokeWidth: 2,
    };
    setOverlays((prev) => [...prev, item]);
    freehandPts.current = [];
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    setShowFreehandPad(false);
    setError(null);
  };

  const addWatermark = () => {
    const item: WatermarkOverlay = {
      id: createId(),
      kind: 'watermark',
      page: 0,
      x: pageSize.w / 2 - 120,
      y: pageSize.h / 2,
      width: 240,
      height: 40,
      rotation: -30,
      opacity: 0.22,
      text: wmText,
      fontSize: 42,
      color: '#991b1b',
      tile: wmTile,
      belowContent: false,
      pageFrom: 1,
      pageTo: pageCount || 1,
    };
    setOverlays((prev) => [...prev.filter((o) => o.kind !== 'watermark'), item]);
  };

  const addPageNumbers = () => {
    const item: PageNumberOverlay = {
      id: createId(),
      kind: 'pageNumber',
      page: 0,
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      rotation: 0,
      opacity: 1,
      format: 'n_of_N',
      prefix: '',
      suffix: '',
      startAt: 1,
      fontSize: 11,
      color: '#374151',
      position: 'footer',
      align: 'center',
    };
    setOverlays((prev) => [...prev.filter((o) => o.kind !== 'pageNumber'), item]);
  };

  const updateOverlay = (id: string, patch: Partial<OverlayItem>) => {
    setOverlays((prev) =>
      prev.map((o) => (o.id === id ? ({ ...o, ...patch } as OverlayItem) : o))
    );
  };

  const duplicateToAll = (id: string) => {
    const src = overlays.find((o) => o.id === id);
    if (!src || src.kind === 'watermark' || src.kind === 'pageNumber') return;
    const copies: OverlayItem[] = [];
    for (let p = 1; p <= pageCount; p++) {
      if (p === src.page) continue;
      copies.push({ ...src, id: createId(), page: p });
    }
    setOverlays((prev) => [...prev, ...copies]);
  };

  const run = async () => {
    if (!file || overlays.length === 0) return;
    setBusy(true);
    setError(null);
    setProgress('Flattening overlays…');
    try {
      const bytes = await file.arrayBuffer();
      const out = await flattenOverlays(bytes, overlays, (c, t) =>
        setProgress(`Page ${c}/${t}`)
      );
      const suffix =
        mode === 'sign'
          ? '-signed'
          : mode === 'watermark'
            ? '-watermark'
            : mode === 'pageNumbers'
              ? '-numbered'
              : '-edited';
      downloadBlobLocally(
        new Blob([out], { type: 'application/pdf' }),
        file.name.replace(/\.pdf$/i, '') + `${suffix}.pdf`
      );
      setProgress('Downloaded');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setProgress(null);
    } finally {
      setBusy(false);
    }
  };

  const onPointer = (
    e: React.PointerEvent<HTMLCanvasElement>,
    type: 'down' | 'move' | 'up',
    target: 'sign' | 'freehand' = 'sign'
  ) => {
    const canvas = target === 'freehand' ? freehandRef.current : drawRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((e.clientY - rect.top) / rect.height) * canvas.height;
    if (type === 'down') {
      drawing.current = true;
      ctx.strokeStyle = '#111827';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x, y);
      if (target === 'freehand') {
        freehandPts.current = [{ x, y }];
      }
    } else if (type === 'move' && drawing.current) {
      ctx.lineTo(x, y);
      ctx.stroke();
      if (target === 'freehand') {
        freehandPts.current.push({ x, y });
      }
    } else if (type === 'up') {
      drawing.current = false;
    }
  };

  return (
    <ToolWorkbench
      title={titles[mode]}
      description={
        mode === 'sign'
          ? 'Electronic / visual signature stamps only — not a cryptographic digital signature.'
          : mode === 'edit'
            ? 'Adds text, shapes, callouts, and freehand overlays. This is not full PDF text editing.'
            : 'Processed locally in your browser.'
      }
      files={files}
      onFilesChange={setFiles}
      busy={busy}
      footer={
        <Button
          variant="primary"
          disabled={!file || busy || overlays.length === 0}
          loading={busy}
          onClick={() => void run()}
        >
          Export & download
        </Button>
      }
    >
      {pageCount > 0 ? (
        <>
          <label className="inline-flex items-center gap-2 text-sm">
            Page
            <select
              className="rounded-lg border border-[var(--color-border)] px-2 py-1"
              value={activePage}
              onChange={(e) => setActivePage(Number(e.target.value))}
              disabled={busy}
            >
              {Array.from({ length: pageCount }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {i + 1}
                </option>
              ))}
            </select>
          </label>

          {mode === 'sign' ? (
            <div className="space-y-3">
              <div>
                <p className="text-sm font-medium">Draw signature</p>
                <canvas
                  ref={drawRef}
                  width={480}
                  height={140}
                  className="mt-1 w-full max-w-md touch-none rounded-lg border border-[var(--color-border)] bg-white"
                  onPointerDown={(e) => onPointer(e, 'down')}
                  onPointerMove={(e) => onPointer(e, 'move')}
                  onPointerUp={(e) => onPointer(e, 'up')}
                  onPointerLeave={(e) => onPointer(e, 'up')}
                />
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      const c = drawRef.current;
                      const ctx = c?.getContext('2d');
                      if (c && ctx) ctx.clearRect(0, 0, c.width, c.height);
                    }}
                  >
                    Clear
                  </Button>
                  <Button size="sm" variant="outline" onClick={addSignatureFromDraw}>
                    Place drawing
                  </Button>
                </div>
              </div>
              <div className="flex flex-wrap items-end gap-2">
                <label className="min-w-[180px] flex-1 text-sm">
                  Type signature
                  <input
                    className="mt-1 w-full rounded-lg border border-[var(--color-border)] px-3 py-2 font-[cursive] text-xl"
                    value={sigText}
                    onChange={(e) => setSigText(e.target.value)}
                  />
                </label>
                <Button size="sm" variant="outline" onClick={addTypedSignature}>
                  Place typed
                </Button>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="file"
                  accept="image/png,image/jpeg"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    const reader = new FileReader();
                    reader.onload = () => {
                      const item: SignatureOverlay = {
                        id: createId(),
                        kind: 'signature',
                        page: activePage,
                        x: 72,
                        y: 72,
                        width: 180,
                        height: 60,
                        rotation: 0,
                        opacity: 1,
                        imageDataUrl: String(reader.result),
                      };
                      setOverlays((prev) => [...prev, item]);
                    };
                    reader.readAsDataURL(f);
                    e.target.value = '';
                  }}
                />
                Upload image
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                />
                Save typed signature on this device after consent
              </label>
            </div>
          ) : null}

          {mode === 'edit' ? (
            <div className="flex flex-wrap gap-2">
              <label className="flex flex-1 items-end gap-2 text-sm">
                <span className="min-w-0 flex-1">
                  Text
                  <input
                    className="mt-1 w-full rounded-lg border border-[var(--color-border)] px-3 py-2"
                    value={textValue}
                    onChange={(e) => setTextValue(e.target.value)}
                  />
                </span>
                <Button size="sm" variant="outline" onClick={addText}>
                  Add text
                </Button>
              </label>
              <Button size="sm" variant="secondary" onClick={() => addShape('rect')}>
                Rectangle
              </Button>
              <Button size="sm" variant="secondary" onClick={() => addShape('ellipse')}>
                Ellipse
              </Button>
              <Button size="sm" variant="secondary" onClick={() => addShape('line')}>
                Line
              </Button>
              <Button size="sm" variant="secondary" onClick={() => addShape('arrow')}>
                Arrow
              </Button>
              <Button size="sm" variant="secondary" onClick={addCallout}>
                Callout
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setShowFreehandPad((v) => !v)}
              >
                Freehand
              </Button>
            </div>
          ) : null}

          {mode === 'edit' && showFreehandPad ? (
            <div className="space-y-2 rounded-xl border border-[var(--color-border)] p-3">
              <p className="text-sm font-medium">Draw freehand on the page</p>
              <canvas
                ref={freehandRef}
                width={480}
                height={280}
                className="mt-1 w-full max-w-md touch-none rounded-lg border border-[var(--color-border)] bg-white"
                onPointerDown={(e) => onPointer(e, 'down', 'freehand')}
                onPointerMove={(e) => onPointer(e, 'move', 'freehand')}
                onPointerUp={(e) => onPointer(e, 'up', 'freehand')}
                onPointerLeave={(e) => onPointer(e, 'up', 'freehand')}
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    freehandPts.current = [];
                    const c = freehandRef.current;
                    const ctx = c?.getContext('2d');
                    if (c && ctx) ctx.clearRect(0, 0, c.width, c.height);
                  }}
                >
                  Clear
                </Button>
                <Button size="sm" variant="outline" onClick={placeFreehand}>
                  Place freehand
                </Button>
              </div>
            </div>
          ) : null}

          {mode === 'watermark' ? (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {WATERMARK_PRESETS.map((p) => (
                  <Button
                    key={p}
                    size="sm"
                    variant="secondary"
                    onClick={() => setWmText(p)}
                  >
                    {p}
                  </Button>
                ))}
              </div>
              <label className="block text-sm">
                Watermark text
                <input
                  className="mt-1 w-full rounded-lg border border-[var(--color-border)] px-3 py-2"
                  value={wmText}
                  onChange={(e) => setWmText(e.target.value)}
                />
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={wmTile}
                  onChange={(e) => setWmTile(e.target.checked)}
                />
                Tile across pages
              </label>
              <Button size="sm" variant="outline" onClick={addWatermark}>
                Apply watermark overlay
              </Button>
            </div>
          ) : null}

          {mode === 'pageNumbers' ? (
            <div className="space-y-2">
              <p className="text-sm text-[var(--color-muted)]">
                Live format preview: 1 of {pageCount || 'N'}
              </p>
              <Button size="sm" variant="outline" onClick={addPageNumbers}>
                Add centered footer numbers (n of N)
              </Button>
            </div>
          ) : null}

          {overlays.length > 0 ? (
            <ul className="max-h-48 space-y-2 overflow-auto text-sm">
              {overlays.map((o) => (
                <li
                  key={o.id}
                  className="rounded-lg border border-[var(--color-border)] p-2"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium capitalize">
                      {o.kind}
                      {o.page > 0 ? ` · page ${o.page}` : ' · all pages'}
                    </span>
                    <span className="flex gap-1">
                      {o.kind !== 'watermark' && o.kind !== 'pageNumber' ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => duplicateToAll(o.id)}
                        >
                          Duplicate to pages
                        </Button>
                      ) : null}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          setOverlays((prev) => prev.filter((x) => x.id !== o.id))
                        }
                      >
                        Delete
                      </Button>
                    </span>
                  </div>
                  {o.kind !== 'pageNumber' ? (
                    <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                      <label>
                        X
                        <input
                          type="number"
                          className="w-full rounded border px-1"
                          value={Math.round(o.x)}
                          onChange={(e) =>
                            updateOverlay(o.id, { x: Number(e.target.value) })
                          }
                        />
                      </label>
                      <label>
                        Y
                        <input
                          type="number"
                          className="w-full rounded border px-1"
                          value={Math.round(o.y)}
                          onChange={(e) =>
                            updateOverlay(o.id, { y: Number(e.target.value) })
                          }
                        />
                      </label>
                      <label>
                        W
                        <input
                          type="number"
                          className="w-full rounded border px-1"
                          value={Math.round(o.width)}
                          onChange={(e) =>
                            updateOverlay(o.id, { width: Number(e.target.value) })
                          }
                        />
                      </label>
                      <label>
                        Opacity
                        <input
                          type="number"
                          min={0}
                          max={1}
                          step={0.05}
                          className="w-full rounded border px-1"
                          value={o.opacity}
                          onChange={(e) =>
                            updateOverlay(o.id, { opacity: Number(e.target.value) })
                          }
                        />
                      </label>
                    </div>
                  ) : (
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                      <label>
                        Format
                        <select
                          className="w-full rounded border px-1"
                          value={o.format}
                          onChange={(e) =>
                            updateOverlay(o.id, {
                              format: e.target.value as PageNumberOverlay['format'],
                            })
                          }
                        >
                          <option value="n">n</option>
                          <option value="n_of_N">n of N</option>
                          <option value="roman">Roman</option>
                        </select>
                      </label>
                      <label>
                        Position
                        <select
                          className="w-full rounded border px-1"
                          value={o.position}
                          onChange={(e) =>
                            updateOverlay(o.id, {
                              position: e.target.value as 'header' | 'footer',
                            })
                          }
                        >
                          <option value="header">Header</option>
                          <option value="footer">Footer</option>
                        </select>
                      </label>
                      <label>
                        Prefix
                        <input
                          className="w-full rounded border px-1"
                          value={o.prefix}
                          onChange={(e) =>
                            updateOverlay(o.id, { prefix: e.target.value })
                          }
                        />
                      </label>
                      <label>
                        Start at
                        <input
                          type="number"
                          className="w-full rounded border px-1"
                          value={o.startAt}
                          onChange={(e) =>
                            updateOverlay(o.id, { startAt: Number(e.target.value) || 1 })
                          }
                        />
                      </label>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          ) : null}
        </>
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
