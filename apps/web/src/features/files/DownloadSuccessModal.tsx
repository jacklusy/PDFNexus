'use client';

import React from 'react';
import { CheckCircle2, Download, FileText, Mail } from 'lucide-react';
import { Dialog } from '@/shared/ui/Dialog';
import { formatBytes } from '@/lib/utils';
import type { GatedDownloadResult } from './useDownloadGate';

export interface DownloadSuccessModalProps {
  result: GatedDownloadResult | null;
  onClose: () => void;
  onDownload: () => void;
}

export function DownloadSuccessModal({
  result,
  onClose,
  onDownload,
}: DownloadSuccessModalProps) {
  if (!result) return null;

  return (
    <Dialog
      open={!!result}
      onClose={onClose}
      title="Ready to download"
      description="Your file was compiled locally, then stored for delivery."
      size="sm"
      showClose
    >
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-emerald-100 bg-emerald-50 text-emerald-600">
        <CheckCircle2 className="h-6 w-6" />
      </div>

      <div className="mb-4 flex items-center gap-3 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] p-3 text-left">
        <div className="rounded-lg border border-red-100 bg-red-50 p-2.5 text-red-500">
          <FileText className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-bold text-[color:var(--color-ink)]">
            {result.fileName}
          </p>
          <p className="text-[10px] font-medium text-[color:var(--color-muted)]">
            {result.pageCount != null
              ? `${result.pageCount} ${result.pageCount === 1 ? 'page' : 'pages'} · `
              : ''}
            {formatBytes(result.size)}
          </p>
        </div>
      </div>

      {result.emailQueued && (
        <p className="mb-4 flex items-center gap-2 rounded-xl border border-teal-100 bg-teal-50 px-3 py-2 text-[11px] font-medium text-teal-900">
          <Mail className="h-3.5 w-3.5 shrink-0" />
          Also sent to your verified email
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl bg-[color:var(--color-surface-2)] px-4 py-2.5 text-xs font-semibold text-[color:var(--color-ink)] hover:bg-[color:var(--color-border)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
        >
          Done
        </button>
        <button
          type="button"
          onClick={onDownload}
          className="flex items-center justify-center gap-1.5 rounded-xl bg-teal-700 px-4 py-2.5 text-xs font-bold text-white shadow-md hover:bg-teal-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
        >
          <Download className="h-3.5 w-3.5" /> Download
        </button>
      </div>
    </Dialog>
  );
}
