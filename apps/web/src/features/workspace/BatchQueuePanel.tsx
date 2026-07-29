'use client';

import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Loader2, Download, RotateCcw, Trash2, ListTodo, X } from 'lucide-react';
import { Button } from '@/shared/ui/Button';
import { downloadBlobLocally } from '@/features/files/localDownload';
import { zipOutputs } from '@/features/tools/zipOutputs';
import { cropPdf } from '@/features/tools/crop/cropPdf';
import { resizePdf } from '@/features/tools/resize/resizePdf';
import { flattenPdf } from '@/features/tools/flatten/flattenPdf';
import { compressPdf, settingsForPreset } from '@/features/tools/compress/compressPdf';
import { PAPER_SIZES_PT } from '@/features/tools/pageGeometry';
import { cropPresetMargins } from '@/features/tools/pageGeometry';
import {
  clearProject,
  saveProject,
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

const TOOL_LABELS: Record<BatchTool, string> = {
  crop: 'Crop',
  resize: 'Resize',
  flatten: 'Flatten',
  compress: 'Compress',
};

function defaultRunners(): Partial<Record<BatchTool, BatchRunner>> {
  return {
    async crop(job) {
      if (!job.inputBlob) throw new Error('Missing input file.');
      const bytes = await job.inputBlob.arrayBuffer();
      const out = await cropPdf({
        bytes,
        margins: cropPresetMargins('normal'),
      });
      return new Blob([out], { type: 'application/pdf' });
    },
    async resize(job) {
      if (!job.inputBlob) throw new Error('Missing input file.');
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
      const bytes = await job.inputBlob.arrayBuffer();
      const result = await flattenPdf(bytes);
      return new Blob([result.bytes], { type: 'application/pdf' });
    },
    async compress(job) {
      if (!job.inputBlob) throw new Error('Missing input file.');
      const bytes = await job.inputBlob.arrayBuffer();
      const result = await compressPdf({
        bytes,
        settings: settingsForPreset('balanced'),
      });
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
  const inputRef = useRef<HTMLInputElement>(null);
  const runners = useMemo(() => defaultRunners(), []);

  const jobs = getSnapshot(queue);

  const persistSession = useCallback(async (q: BatchQueue) => {
    try {
      await saveProject({
        id: 'workspace-batch',
        name: 'Workspace batch',
        settings: {
          jobCount: q.jobs.length,
          tools: q.jobs.map((j) => j.tool),
        },
        updatedAt: Date.now(),
      });
    } catch {
      // IndexedDB optional in private mode
    }
  }, []);

  const onFilesPicked = async (list: FileList | null) => {
    if (!list?.length) return;
    setError(null);
    let next = queue;
    for (const file of Array.from(list)) {
      const suffix = TOOL_LABELS[tool].toLowerCase();
      next = enqueue(next, {
        id: createJobId(),
        tool,
        fileName: file.name.replace(/\.pdf$/i, '') + `-${suffix}.pdf`,
        inputBlob: file,
      });
    }
    setQueue(next);
    await persistSession(next);
    setMessage(`Queued ${list.length} ${TOOL_LABELS[tool]} job(s).`);
  };

  const runPending = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    setMessage('Running batch…');
    try {
      const result = await runAll(queue, runners, (q) => setQueue({ ...q }));
      setQueue(result);
      await persistSession(result);
      const done = result.jobs.filter((j) => j.status === 'done').length;
      const failed = result.jobs.filter((j) => j.status === 'failed').length;
      setMessage(`Batch finished: ${done} done, ${failed} failed.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const retryFailed = async (jobId: string) => {
    const next = retry(queue, jobId);
    setQueue(next);
    setBusy(true);
    setError(null);
    try {
      const result = await runAll(next, runners, (q) => setQueue({ ...q }));
      setQueue(result);
      await persistSession(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
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
      setMessage('Project storage cleared.');
    } catch (e) {
      if (e instanceof ProjectStoreQuotaWarning) {
        setError(e.message);
      } else {
        setError(e instanceof Error ? e.message : String(e));
      }
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

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

          <ul className="space-y-2" aria-live="polite">
            {jobs.length === 0 ? (
              <li className="text-xs text-slate-500">
                No jobs yet. Add PDFs to queue crop, resize, flatten, or compress work.
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
                      <p className={`text-[11px] font-bold uppercase ${statusClass(job.status)}`}>
                        {TOOL_LABELS[job.tool]} · {job.status}
                      </p>
                      {job.error ? (
                        <p className="mt-0.5 text-[11px] text-red-600">{job.error}</p>
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
            <p className="text-xs text-red-600" role="alert">
              {error}
            </p>
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
