'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Download, RotateCcw, Trash2, ListTodo, X } from 'lucide-react';
import { Button } from '@/shared/ui/Button';
import { downloadBlobLocally } from '@/features/files/localDownload';
import { zipOutputs } from '@/features/tools/zipOutputs';
import { cropPdf } from '@/features/tools/crop/cropPdf';
import { resizePdf } from '@/features/tools/resize/resizePdf';
import { flattenPdf, FLATTEN_WARNING } from '@/features/tools/flatten/flattenPdf';
import { compressPdf, settingsForPreset } from '@/features/tools/compress/compressPdf';
import { flattenOverlays } from '@/features/tools/overlays/flattenOverlays';
import {
  createId,
  type PageNumberOverlay,
  type WatermarkOverlay,
} from '@/features/tools/overlays/types';
import { loadReadablePdf, sanitizeToolkitError } from '@/features/tools/assertPdfReadable';
import { clearPassword, getPdfToolkit } from '@/features/tools/protect/pdfToolkit';
import { pdfToImages } from '@/features/tools/pdf-to-images/pdfToImages';
import { batesPdf } from '@/features/tools/bates/batesPdf';
import { PAPER_SIZES_PT, cropPresetMargins } from '@/features/tools/pageGeometry';
import { ToolProgress } from '@/features/tools/ToolProgress';
import { ToolError } from '@/features/tools/ToolError';
import { useTimedProgress } from '@/features/tools/useTimedProgress';
import {
  clearProject,
  saveProject,
  saveFileBlob,
  loadFileBlob,
  loadProject,
  saveSetting,
  loadSetting,
  ProjectStoreQuotaWarning,
} from './projectStore';
import {
  createJobId,
  createQueue,
  enqueue,
  getSnapshot,
  retry,
  runAll,
  type BatchJob,
  type BatchQueue,
  type BatchRunner,
  type BatchTool,
} from './batchQueue';

const PROJECT_ID = 'workspace-batch';
const TOOL_SETTINGS_KEY = 'batch.toolSettings';

const TOOL_LABELS: Record<BatchTool, string> = {
  crop: 'Crop',
  resize: 'Resize',
  flatten: 'Flatten',
  compress: 'Compress',
  watermark: 'Watermark',
  pageNumbers: 'Page numbers',
  protect: 'Protect',
  pdfToJpg: 'PDF to JPG',
  bates: 'Bates',
};

export interface BatchToolSettings {
  watermarkText: string;
  pageNumberFormat: PageNumberOverlay['format'];
  pdfToJpgMode: 'first' | 'all';
  batesPrefix: string;
  batesStart: number;
  batesWidth: number;
}

const DEFAULT_TOOL_SETTINGS: BatchToolSettings = {
  watermarkText: 'Confidential',
  pageNumberFormat: 'n_of_N',
  pdfToJpgMode: 'first',
  batesPrefix: 'CASE-',
  batesStart: 1,
  batesWidth: 6,
};

type ProgressReporter = (
  stage: string,
  current?: number,
  total?: number
) => void;

function outputFileName(
  inputName: string,
  tool: BatchTool,
  settings: BatchToolSettings
): string {
  const base = inputName.replace(/\.pdf$/i, '') || 'document';
  switch (tool) {
    case 'pdfToJpg':
      return settings.pdfToJpgMode === 'all'
        ? `${base}-images.zip`
        : `${base}-p1.jpg`;
    case 'pageNumbers':
      return `${base}-numbered.pdf`;
    default: {
      const suffix = TOOL_LABELS[tool].toLowerCase().replace(/\s+/g, '-');
      return `${base}-${suffix}.pdf`;
    }
  }
}

async function buildWatermarkOverlay(
  bytes: ArrayBuffer,
  text: string
): Promise<WatermarkOverlay> {
  const doc = await loadReadablePdf(bytes.slice(0));
  const pageCount = doc.getPageCount();
  const { width, height } = doc.getPages()[0].getSize();
  return {
    id: createId(),
    kind: 'watermark',
    page: 0,
    x: width / 2 - 120,
    y: height / 2,
    width: 240,
    height: 40,
    rotation: -30,
    opacity: 0.22,
    text: text || 'Confidential',
    fontSize: 42,
    color: '#991b1b',
    tile: false,
    belowContent: false,
    pageFrom: 1,
    pageTo: pageCount,
  };
}

function buildPageNumberOverlay(
  format: PageNumberOverlay['format']
): PageNumberOverlay {
  return {
    id: createId(),
    kind: 'pageNumber',
    page: 0,
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    rotation: 0,
    opacity: 1,
    format,
    prefix: '',
    suffix: '',
    startAt: 1,
    fontSize: 11,
    color: '#374151',
    position: 'footer',
    align: 'center',
  };
}

function createRunners(opts: {
  settings: BatchToolSettings;
  getProtectPassword: () => string;
  getBatesStart: () => number;
  setBatesStart: (n: number) => void;
  onProgress: ProgressReporter;
}): Partial<Record<BatchTool, BatchRunner>> {
  const report = opts.onProgress;
  return {
    async crop(job) {
      if (!job.inputBlob) throw new Error('Missing input file.');
      report('Cropping…');
      const bytes = await job.inputBlob.arrayBuffer();
      const out = await cropPdf({
        bytes,
        margins: cropPresetMargins('normal'),
      });
      return new Blob([out], { type: 'application/pdf' });
    },
    async resize(job) {
      if (!job.inputBlob) throw new Error('Missing input file.');
      report('Resizing…');
      const bytes = await job.inputBlob.arrayBuffer();
      const out = await resizePdf({
        bytes,
        target: PAPER_SIZES_PT.A4,
        mode: 'fit',
      });
      return new Blob([out], { type: 'application/pdf' });
    },
    async flatten(job) {
      if (!job.inputBlob) throw new Error('Missing input file.');
      report('Flattening…');
      const bytes = await job.inputBlob.arrayBuffer();
      const result = await flattenPdf(bytes);
      if (result.annotationError && !result.annotationsFlattened) {
        throw new Error(
          result.formsFlattened
            ? `Forms flattened, but annotations were not: ${result.annotationError}`
            : result.annotationError
        );
      }
      return new Blob([result.bytes], { type: 'application/pdf' });
    },
    async compress(job) {
      if (!job.inputBlob) throw new Error('Missing input file.');
      report('Compressing…');
      const bytes = await job.inputBlob.arrayBuffer();
      const result = await compressPdf({
        bytes,
        settings: settingsForPreset('balanced'),
        onProgress: (c, t, msg) => report(msg || `Compressing ${c}/${t}`, c, t),
      });
      return new Blob([result.bytes], { type: 'application/pdf' });
    },
    async watermark(job) {
      if (!job.inputBlob) throw new Error('Missing input file.');
      report('Applying watermark…');
      const bytes = await job.inputBlob.arrayBuffer();
      const overlay = await buildWatermarkOverlay(
        bytes,
        opts.settings.watermarkText
      );
      const out = await flattenOverlays(bytes, [overlay], (c, t) =>
        report(`Watermark page ${c}/${t}`, c, t)
      );
      return new Blob([out], { type: 'application/pdf' });
    },
    async pageNumbers(job) {
      if (!job.inputBlob) throw new Error('Missing input file.');
      report('Adding page numbers…');
      const bytes = await job.inputBlob.arrayBuffer();
      const overlay = buildPageNumberOverlay(opts.settings.pageNumberFormat);
      const out = await flattenOverlays(bytes, [overlay], (c, t) =>
        report(`Numbering page ${c}/${t}`, c, t)
      );
      return new Blob([out], { type: 'application/pdf' });
    },
    async protect(job) {
      if (!job.inputBlob) throw new Error('Missing input file.');
      const password = opts.getProtectPassword();
      if (!password) throw new Error('Set and confirm a protect password first.');
      let user = password;
      try {
        report('Encrypting…');
        const toolkit = await getPdfToolkit();
        const bytes = await job.inputBlob.arrayBuffer();
        const locked = await toolkit.lock(new Uint8Array(bytes), {
          userPassword: user,
          ownerPassword: user,
          keyLength: 256,
          permissions: {
            print: 'full',
            modify: 'none',
            extract: false,
          },
        });
        return new Blob([locked], { type: 'application/pdf' });
      } catch (e) {
        throw new Error(sanitizeToolkitError(e));
      } finally {
        clearPassword(user);
        user = '';
      }
    },
    async pdfToJpg(job) {
      if (!job.inputBlob) throw new Error('Missing input file.');
      report('Rendering images…');
      const bytes = await job.inputBlob.arrayBuffer();
      const doc = await loadReadablePdf(bytes.slice(0));
      const pageCount = doc.getPageCount();
      const mode = opts.settings.pdfToJpgMode;
      const pages =
        mode === 'first'
          ? [1]
          : Array.from({ length: pageCount }, (_, i) => i + 1);
      const baseName = job.fileName.replace(/\.(pdf|zip|jpg)$/i, '') || 'page';
      const result = await pdfToImages({
        bytes,
        pages,
        format: 'image/jpeg',
        scale: 2,
        quality: 0.85,
        background: '#ffffff',
        namePattern: '{name}-p{n}',
        baseName,
        onProgress: (c, t) => report(`Rendering ${c}/${t}`, c, t),
      });
      if (result.zipBlob) return result.zipBlob;
      if (result.files[0]) return result.files[0].blob;
      throw new Error('No images produced.');
    },
    async bates(job) {
      if (!job.inputBlob) throw new Error('Missing input file.');
      report('Applying Bates numbers…');
      const bytes = await job.inputBlob.arrayBuffer();
      const start = opts.getBatesStart();
      const result = await batesPdf({
        bytes,
        start,
        width: opts.settings.batesWidth,
        prefix: opts.settings.batesPrefix,
        suffix: '',
        position: 'footer',
        align: 'right',
        onProgress: (c, t) => report(`Bates page ${c}/${t}`, c, t),
      });
      opts.setBatesStart(result.nextNumber);
      return new Blob([result.bytes], { type: 'application/pdf' });
    },
  };
}

function statusClass(status: BatchJob['status']): string {
  switch (status) {
    case 'pending':
      return 'text-slate-500';
    case 'running':
      return 'text-teal-700';
    case 'done':
      return 'text-emerald-700';
    case 'failed':
      return 'text-red-600';
  }
}

export interface BatchQueuePanelProps {
  open: boolean;
  onClose: () => void;
}

export function BatchQueuePanel({ open, onClose }: BatchQueuePanelProps) {
  const [queue, setQueue] = useState<BatchQueue>(() => createQueue());
  const [tool, setTool] = useState<BatchTool>('compress');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [flattenConfirmed, setFlattenConfirmed] = useState(false);
  const [restored, setRestored] = useState(false);
  const [toolSettings, setToolSettings] =
    useState<BatchToolSettings>(DEFAULT_TOOL_SETTINGS);
  const [protectPassword, setProtectPassword] = useState('');
  const [protectConfirm, setProtectConfirm] = useState('');
  const [protectReady, setProtectReady] = useState(false);
  const [runStage, setRunStage] = useState<string | null>(null);
  const [runCurrent, setRunCurrent] = useState(0);
  const [runTotal, setRunTotal] = useState(0);
  const [jobCurrent, setJobCurrent] = useState(0);
  const [jobTotal, setJobTotal] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const protectPasswordRef = useRef('');
  const batesStartRef = useRef(toolSettings.batesStart);
  const abortRef = useRef<AbortController | null>(null);
  const { elapsedLabel } = useTimedProgress(busy && !!runStage);

  useEffect(() => {
    batesStartRef.current = toolSettings.batesStart;
  }, [toolSettings.batesStart]);

  useEffect(() => {
    protectPasswordRef.current = protectReady ? protectPassword : '';
  }, [protectPassword, protectReady]);

  const onProgress = useCallback<ProgressReporter>((stage, current, total) => {
    setRunStage(stage);
    if (current != null && total != null) {
      setRunCurrent(current);
      setRunTotal(total);
    }
  }, []);

  const runners = useMemo(
    () =>
      createRunners({
        settings: toolSettings,
        getProtectPassword: () => protectPasswordRef.current,
        getBatesStart: () => batesStartRef.current,
        setBatesStart: (n) => {
          batesStartRef.current = n;
          setToolSettings((prev) => ({ ...prev, batesStart: n }));
        },
        onProgress,
      }),
    [toolSettings, onProgress]
  );

  const jobs = getSnapshot(queue);
  const runningJob = jobs.find((j) => j.status === 'running');

  const persistSettings = useCallback(async (settings: BatchToolSettings) => {
    try {
      await saveSetting(TOOL_SETTINGS_KEY, settings);
    } catch {
      // IndexedDB optional
    }
  }, []);

  const updateSettings = useCallback(
    (patch: Partial<BatchToolSettings>) => {
      setToolSettings((prev) => {
        const next = { ...prev, ...patch };
        void persistSettings(next);
        return next;
      });
    },
    [persistSettings]
  );

  const persistSession = useCallback(async (q: BatchQueue) => {
    try {
      await saveProject({
        id: PROJECT_ID,
        name: 'Workspace batch',
        settings: {
          jobs: q.jobs.map((j) => ({
            id: j.id,
            tool: j.tool,
            status: j.status,
            fileName: j.fileName,
            error: j.error,
          })),
        },
        updatedAt: Date.now(),
      });
      for (const job of q.jobs) {
        if (job.inputBlob) {
          await saveFileBlob(`${PROJECT_ID}:in:${job.id}`, job.inputBlob, PROJECT_ID);
        }
        if (job.resultBlob) {
          await saveFileBlob(`${PROJECT_ID}:out:${job.id}`, job.resultBlob, PROJECT_ID);
        }
      }
    } catch (e) {
      if (e instanceof ProjectStoreQuotaWarning) throw e;
      // IndexedDB optional in private mode
    }
  }, []);

  useEffect(() => {
    if (!open || restored) return;
    let cancelled = false;
    (async () => {
      try {
        const savedSettings = await loadSetting<BatchToolSettings>(TOOL_SETTINGS_KEY);
        if (savedSettings && !cancelled) {
          setToolSettings({ ...DEFAULT_TOOL_SETTINGS, ...savedSettings });
          batesStartRef.current =
            savedSettings.batesStart ?? DEFAULT_TOOL_SETTINGS.batesStart;
        }
        const project = await loadProject(PROJECT_ID);
        const saved = project?.settings?.jobs as
          | Array<{
              id: string;
              tool: BatchTool;
              status: BatchJob['status'];
              fileName: string;
              error?: string;
            }>
          | undefined;
        if (!saved?.length || cancelled) {
          setRestored(true);
          return;
        }
        const restoredJobs: BatchJob[] = [];
        for (const meta of saved) {
          const inputBlob =
            (await loadFileBlob(`${PROJECT_ID}:in:${meta.id}`)) ?? undefined;
          const resultBlob =
            (await loadFileBlob(`${PROJECT_ID}:out:${meta.id}`)) ?? undefined;
          restoredJobs.push({
            id: meta.id,
            tool: meta.tool,
            status: meta.status === 'running' ? 'pending' : meta.status,
            fileName: meta.fileName,
            error: meta.error,
            inputBlob,
            resultBlob,
          });
        }
        if (!cancelled) {
          setQueue({ jobs: restoredJobs });
          setMessage(`Restored ${restoredJobs.length} job(s) from last session.`);
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) setRestored(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, restored]);

  const confirmProtectPassword = () => {
    if (!protectPassword) {
      setError('Enter a password for protect jobs.');
      return;
    }
    if (protectPassword !== protectConfirm) {
      setError('Protect passwords do not match.');
      return;
    }
    setProtectReady(true);
    setError(null);
    setMessage('Protect password confirmed for this batch session.');
  };

  const onFilesPicked = async (list: FileList | null) => {
    if (!list?.length) return;
    setError(null);
    let next = queue;
    for (const file of Array.from(list)) {
      next = enqueue(next, {
        id: createJobId(),
        tool,
        fileName: outputFileName(file.name, tool, toolSettings),
        inputBlob: file,
      });
    }
    setQueue(next);
    try {
      await persistSession(next);
    } catch (e) {
      if (e instanceof ProjectStoreQuotaWarning) setError(e.message);
    }
    setMessage(`Queued ${list.length} ${TOOL_LABELS[tool]} job(s).`);
  };

  const runPending = async () => {
    if (busy) return;
    const hasFlatten = queue.jobs.some(
      (j) => j.status === 'pending' && j.tool === 'flatten'
    );
    if (hasFlatten && !flattenConfirmed) {
      setError('Confirm the flatten warning before running flatten jobs.');
      return;
    }
    const hasProtect = queue.jobs.some(
      (j) => j.status === 'pending' && j.tool === 'protect'
    );
    if (hasProtect && !protectReady) {
      setError('Confirm the protect password before running protect jobs.');
      return;
    }
    setBusy(true);
    setError(null);
    setMessage('Running batch…');
    setRunStage('Starting…');
    setRunCurrent(0);
    setRunTotal(0);
    const pendingCount = queue.jobs.filter((j) => j.status === 'pending').length;
    setJobCurrent(0);
    setJobTotal(pendingCount);
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      const result = await runAll(
        queue,
        runners,
        (q) => {
          setQueue({ ...q });
          const doneOrFailed = q.jobs.filter(
            (j) => j.status === 'done' || j.status === 'failed'
          ).length;
          const started =
            q.jobs.filter((j) => j.status !== 'pending').length;
          setJobCurrent(Math.min(started, pendingCount));
          const running = q.jobs.find((j) => j.status === 'running');
          if (running) {
            setRunStage((prev) => prev || `${TOOL_LABELS[running.tool]}…`);
          }
          void doneOrFailed;
        },
        ac.signal
      );
      setQueue(result);
      await persistSession(result);
      await persistSettings({
        ...toolSettings,
        batesStart: batesStartRef.current,
      });
      const done = result.jobs.filter((j) => j.status === 'done').length;
      const failed = result.jobs.filter((j) => j.status === 'failed').length;
      setMessage(`Batch finished: ${done} done, ${failed} failed.`);
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') {
        setMessage('Batch cancelled. Remaining jobs stay pending.');
      } else {
        setError(e instanceof Error ? e.message : String(e));
      }
    } finally {
      abortRef.current = null;
      setBusy(false);
      setRunStage(null);
      setRunCurrent(0);
      setRunTotal(0);
      setJobCurrent(0);
      setJobTotal(0);
    }
  };

  const retryFailed = async (jobId: string) => {
    const next = retry(queue, jobId);
    setQueue(next);
    setBusy(true);
    setError(null);
    setRunStage('Retrying…');
    try {
      const result = await runAll(next, runners, (q) => setQueue({ ...q }));
      setQueue(result);
      await persistSession(result);
      await persistSettings({
        ...toolSettings,
        batesStart: batesStartRef.current,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      setRunStage(null);
      setRunCurrent(0);
      setRunTotal(0);
    }
  };

  const downloadAllZip = async () => {
    const completed = queue.jobs.filter((j) => j.status === 'done' && j.resultBlob);
    if (!completed.length) {
      setError('No completed jobs to download.');
      return;
    }
    setBusy(true);
    try {
      const zip = await zipOutputs(
        completed.map((j) => ({
          fileName: j.fileName,
          blob: j.resultBlob!,
        }))
      );
      downloadBlobLocally(zip, 'pdfnexus-batch.zip');
      setMessage(`Downloaded ZIP (${completed.length} files).`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const onClearProject = async () => {
    setBusy(true);
    setError(null);
    try {
      await clearProject();
      setQueue(createQueue());
      setFlattenConfirmed(false);
      setProtectPassword('');
      setProtectConfirm('');
      setProtectReady(false);
      setMessage('Project storage cleared.');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  const showToolSettings =
    tool === 'watermark' ||
    tool === 'pageNumbers' ||
    tool === 'pdfToJpg' ||
    tool === 'bates' ||
    tool === 'protect' ||
    jobs.some((j) =>
      ['watermark', 'pageNumbers', 'pdfToJpg', 'bates', 'protect'].includes(j.tool)
    );

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="batch-queue-title"
    >
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <h2
            id="batch-queue-title"
            className="flex items-center gap-2 text-sm font-bold text-slate-900"
          >
            <ListTodo className="h-4 w-4 text-teal-700" />
            Batch queue
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            aria-label="Close batch queue"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3 overflow-y-auto px-4 py-3">
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-xs font-semibold text-slate-600">
              Tool
              <select
                value={tool}
                onChange={(e) => setTool(e.target.value as BatchTool)}
                className="mt-1 block rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm"
              >
                {(Object.keys(TOOL_LABELS) as BatchTool[]).map((t) => (
                  <option key={t} value={t}>
                    {TOOL_LABELS[t]}
                  </option>
                ))}
              </select>
            </label>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => inputRef.current?.click()}
              disabled={busy}
            >
              Add PDFs
            </Button>
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf,.pdf"
              multiple
              className="hidden"
              onChange={(e) => {
                void onFilesPicked(e.target.files);
                e.target.value = '';
              }}
            />
            <Button
              variant="primary"
              size="sm"
              disabled={busy || !jobs.some((j) => j.status === 'pending')}
              onClick={() => void runPending()}
            >
              {busy ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Running…
                </>
              ) : (
                'Run pending'
              )}
            </Button>
          </div>

          {showToolSettings ? (
            <div className="grid gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
              {tool === 'watermark' ||
              jobs.some((j) => j.tool === 'watermark') ? (
                <label className="font-semibold text-slate-600">
                  Watermark text
                  <input
                    className="mt-1 w-full rounded border border-slate-200 px-2 py-1 text-sm font-normal"
                    value={toolSettings.watermarkText}
                    onChange={(e) =>
                      updateSettings({ watermarkText: e.target.value })
                    }
                    disabled={busy}
                  />
                </label>
              ) : null}
              {tool === 'pageNumbers' ||
              jobs.some((j) => j.tool === 'pageNumbers') ? (
                <label className="font-semibold text-slate-600">
                  Page number format
                  <select
                    className="mt-1 w-full rounded border border-slate-200 px-2 py-1 text-sm font-normal"
                    value={toolSettings.pageNumberFormat}
                    onChange={(e) =>
                      updateSettings({
                        pageNumberFormat: e.target
                          .value as PageNumberOverlay['format'],
                      })
                    }
                    disabled={busy}
                  >
                    <option value="n">n</option>
                    <option value="n_of_N">n of N</option>
                    <option value="roman">Roman</option>
                  </select>
                </label>
              ) : null}
              {tool === 'pdfToJpg' ||
              jobs.some((j) => j.tool === 'pdfToJpg') ? (
                <fieldset className="space-y-1">
                  <legend className="font-semibold text-slate-600">
                    PDF to JPG
                  </legend>
                  <label className="flex items-center gap-2 font-normal">
                    <input
                      type="radio"
                      name="batch-jpg-mode"
                      checked={toolSettings.pdfToJpgMode === 'first'}
                      onChange={() => updateSettings({ pdfToJpgMode: 'first' })}
                      disabled={busy}
                    />
                    First page JPG
                  </label>
                  <label className="flex items-center gap-2 font-normal">
                    <input
                      type="radio"
                      name="batch-jpg-mode"
                      checked={toolSettings.pdfToJpgMode === 'all'}
                      onChange={() => updateSettings({ pdfToJpgMode: 'all' })}
                      disabled={busy}
                    />
                    All pages ZIP
                  </label>
                </fieldset>
              ) : null}
              {tool === 'bates' || jobs.some((j) => j.tool === 'bates') ? (
                <div className="grid grid-cols-3 gap-2">
                  <label className="font-semibold text-slate-600">
                    Prefix
                    <input
                      className="mt-1 w-full rounded border border-slate-200 px-2 py-1 text-sm font-normal"
                      value={toolSettings.batesPrefix}
                      onChange={(e) =>
                        updateSettings({ batesPrefix: e.target.value })
                      }
                      disabled={busy}
                    />
                  </label>
                  <label className="font-semibold text-slate-600">
                    Start
                    <input
                      type="number"
                      min={0}
                      className="mt-1 w-full rounded border border-slate-200 px-2 py-1 text-sm font-normal"
                      value={toolSettings.batesStart}
                      onChange={(e) =>
                        updateSettings({
                          batesStart: Number(e.target.value) || 0,
                        })
                      }
                      disabled={busy}
                    />
                  </label>
                  <label className="font-semibold text-slate-600">
                    Width
                    <input
                      type="number"
                      min={1}
                      max={12}
                      className="mt-1 w-full rounded border border-slate-200 px-2 py-1 text-sm font-normal"
                      value={toolSettings.batesWidth}
                      onChange={(e) =>
                        updateSettings({
                          batesWidth: Number(e.target.value) || 1,
                        })
                      }
                      disabled={busy}
                    />
                  </label>
                </div>
              ) : null}
              {tool === 'protect' ||
              jobs.some((j) => j.tool === 'protect') ? (
                <div className="space-y-2">
                  <p className="font-semibold text-slate-600">
                    Protect password (session only — never stored)
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="password"
                      autoComplete="new-password"
                      placeholder="Password"
                      className="rounded border border-slate-200 px-2 py-1 text-sm"
                      value={protectPassword}
                      onChange={(e) => {
                        setProtectPassword(e.target.value);
                        setProtectReady(false);
                      }}
                      disabled={busy}
                    />
                    <input
                      type="password"
                      autoComplete="new-password"
                      placeholder="Confirm"
                      className="rounded border border-slate-200 px-2 py-1 text-sm"
                      value={protectConfirm}
                      onChange={(e) => {
                        setProtectConfirm(e.target.value);
                        setProtectReady(false);
                      }}
                      disabled={busy}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={busy || !protectPassword}
                    onClick={confirmProtectPassword}
                  >
                    {protectReady ? 'Password confirmed' : 'Confirm password'}
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}

          {jobs.some((j) => j.tool === 'flatten') ? (
            <label className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-slate-700">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={flattenConfirmed}
                onChange={(e) => setFlattenConfirmed(e.target.checked)}
                disabled={busy}
              />
              <span>
                <strong>Flatten warning:</strong> {FLATTEN_WARNING}
              </span>
            </label>
          ) : null}

          {busy && runStage ? (
            <ToolProgress
              stage={
                runningJob
                  ? `${TOOL_LABELS[runningJob.tool]}: ${runStage}`
                  : runStage
              }
              percent={
                jobTotal > 0
                  ? Math.round((jobCurrent / jobTotal) * 100)
                  : runTotal > 0
                    ? Math.round((runCurrent / runTotal) * 100)
                    : null
              }
              currentPage={runTotal > 0 ? runCurrent : undefined}
              totalPages={runTotal > 0 ? runTotal : undefined}
              currentFile={jobTotal > 0 ? Math.max(jobCurrent, 1) : undefined}
              totalFiles={jobTotal > 0 ? jobTotal : undefined}
              elapsedLabel={elapsedLabel}
              onCancel={() => {
                abortRef.current?.abort();
                setMessage('Cancelling after current job…');
              }}
            />
          ) : null}

          <ul className="space-y-2" aria-live="polite">
            {jobs.length === 0 ? (
              <li className="text-xs text-slate-500">
                No jobs yet. Add PDFs to queue batch work across supported tools.
              </li>
            ) : (
              jobs.map((job) => (
                <li
                  key={job.id}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-slate-800">
                        {job.fileName}
                      </p>
                      <p
                        className={`text-[11px] font-bold uppercase ${statusClass(job.status)}`}
                      >
                        {TOOL_LABELS[job.tool] ?? job.tool} · {job.status}
                      </p>
                      {job.error ? (
                        <div className="mt-1">
                          <ToolError message={job.error} fileName={job.fileName} />
                        </div>
                      ) : null}
                    </div>
                    {job.status === 'failed' ? (
                      <button
                        type="button"
                        title="Retry"
                        onClick={() => void retryFailed(job.id)}
                        className="rounded-lg p-1.5 text-slate-600 hover:bg-white"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                      </button>
                    ) : null}
                    {job.status === 'done' && job.resultBlob ? (
                      <button
                        type="button"
                        title="Download"
                        onClick={() =>
                          downloadBlobLocally(job.resultBlob!, job.fileName)
                        }
                        className="rounded-lg p-1.5 text-teal-700 hover:bg-white"
                      >
                        <Download className="h-3.5 w-3.5" />
                      </button>
                    ) : null}
                  </div>
                </li>
              ))
            )}
          </ul>

          {message ? <p className="text-xs text-slate-600">{message}</p> : null}
          {error ? (
            <ToolError
              message={error}
              onRetry={() => setError(null)}
            />
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2 border-t border-slate-100 px-4 py-3">
          <Button
            variant="secondary"
            size="sm"
            disabled={busy || !jobs.some((j) => j.status === 'done')}
            onClick={() => void downloadAllZip()}
          >
            <Download className="h-3.5 w-3.5" />
            Download all ZIP
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={() => void onClearProject()}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Clear project
          </Button>
        </div>
      </div>
    </div>
  );
}

export default BatchQueuePanel;
