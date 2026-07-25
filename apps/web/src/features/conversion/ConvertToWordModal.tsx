'use client';

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  FileText,
  Sparkles,
  CheckCircle2,
  Loader2,
  Download,
  X,
  Layers,
  FileType,
  FileCheck,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { PDFFile, PDFPageItem, FileStore } from '@/lib/types';
import { convertPDFToDocx } from '@/lib/pdf/pdfToDocx';
import { revokeObjectUrl, trackObjectUrl } from '@/lib/pdf/pdfHelpers';
import { trackEvent } from '@/lib/analytics';
import { formatBytes } from '@/lib/utils';

interface ConvertToWordModalProps {
  isOpen: boolean;
  onClose: () => void;
  files: PDFFile[];
  pages: PDFPageItem[];
  selectedPageIds: Set<string>;
  fileStore: FileStore;
  onRequestGatedDownload?: (blob: Blob, fileName: string) => Promise<void>;
}

export default function ConvertToWordModal({
  isOpen,
  onClose,
  files,
  pages,
  selectedPageIds,
  fileStore,
  onRequestGatedDownload,
}: ConvertToWordModalProps) {
  const [targetSource, setTargetSource] = useState<'all' | 'selected' | 'file'>('all');
  const [selectedFileId, setSelectedFileId] = useState<string>('');
  const [isConverting, setIsConverting] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  const [currentProgress, setCurrentProgress] = useState({ current: 0, total: 0 });
  const [convertedDocx, setConvertedDocx] = useState<{
    blobUrl: string;
    size: number;
    fileName: string;
  } | null>(null);
  const [conversionError, setConversionError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setTargetSource(selectedPageIds.size > 0 ? 'selected' : 'all');
    setSelectedFileId(files[0]?.id || '');
    setIsConverting(false);
    setProgressMsg('');
    setCurrentProgress({ current: 0, total: 0 });
    setConversionError(null);
    setConvertedDocx((prev) => {
      if (prev?.blobUrl) revokeObjectUrl(prev.blobUrl);
      return null;
    });
  }, [isOpen, selectedPageIds.size, files]);

  if (!isOpen) return null;

  const getPagesToConvert = (): { pageItems: PDFPageItem[]; outputFileName: string } => {
    if (targetSource === 'selected' && selectedPageIds.size > 0) {
      return {
        pageItems: pages.filter((p) => selectedPageIds.has(p.id)),
        outputFileName: 'selected_pages.docx',
      };
    }
    if (targetSource === 'file' && selectedFileId) {
      const targetFile = files.find((f) => f.id === selectedFileId);
      const items = pages.filter((p) => p.originalFileId === selectedFileId);
      const name = targetFile
        ? targetFile.name.replace(/\.pdf$/i, '') + '.docx'
        : 'converted_document.docx';
      return { pageItems: items, outputFileName: name };
    }
    return {
      pageItems: pages,
      outputFileName:
        files.length === 1
          ? files[0].name.replace(/\.pdf$/i, '') + '.docx'
          : 'converted_workspace.docx',
    };
  };

  const handleStartConversion = async () => {
    const { pageItems, outputFileName } = getPagesToConvert();
    if (pageItems.length === 0) {
      setConversionError('No pages selected for conversion.');
      return;
    }

    setIsConverting(true);
    setConversionError(null);
    setProgressMsg('Initializing high-fidelity conversion engine...');
    setCurrentProgress({ current: 0, total: pageItems.length });
    setConvertedDocx((prev) => {
      if (prev?.blobUrl) revokeObjectUrl(prev.blobUrl);
      return null;
    });

    try {
      const docxBlob = await convertPDFToDocx(pageItems, fileStore, (current, total, msg) => {
        setCurrentProgress({ current, total });
        setProgressMsg(msg);
      });

      trackEvent('convert', { tool: 'pdf-to-word' });

      if (onRequestGatedDownload) {
        await onRequestGatedDownload(docxBlob, outputFileName);
        onClose();
        return;
      }

      const blobUrl = trackObjectUrl(URL.createObjectURL(docxBlob));
      setConvertedDocx({ blobUrl, size: docxBlob.size, fileName: outputFileName });
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = outputFileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: unknown) {
      console.error('PDF to DOCX conversion failed:', err);
      setConversionError(
        err instanceof Error
          ? err.message
          : 'An unexpected error occurred during document conversion.'
      );
    } finally {
      setIsConverting(false);
    }
  };

  const handleDownloadDocx = () => {
    if (!convertedDocx) return;
    const link = document.createElement('a');
    link.href = convertedDocx.blobUrl;
    link.download = convertedDocx.fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const { pageItems } = getPagesToConvert();

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/80 p-4 backdrop-blur-sm"
      >
        <motion.div
          initial={{ scale: 0.95, y: 15 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.95, y: 15 }}
          className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-slate-100 bg-white p-6 shadow-2xl"
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="rounded-xl border border-teal-100/80 bg-teal-50 p-2.5 text-teal-700">
                <FileType className="h-5 w-5" />
              </div>
              <div>
                <h3 className="flex items-center gap-2 text-base font-extrabold tracking-tight text-slate-900">
                  Convert PDF to Word (.docx)
                  <span className="flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                    <Sparkles className="h-3 w-3 text-emerald-600" /> Maximum Fidelity
                  </span>
                </h3>
                <p className="text-xs text-slate-500">
                  Preserves structure, formatting, tables, images, and fonts.
                </p>
              </div>
            </div>
            {!isConverting && (
              <button
                type="button"
                onClick={onClose}
                className="cursor-pointer rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>

          {!isConverting && !convertedDocx && !conversionError ? (
            <div className="mt-5 space-y-5">
              <div>
                <label className="mb-2 block text-xs font-bold text-slate-700">
                  Select Document Source
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      ['all', 'All Workspace', pages.length + ' Pages', Layers],
                      [
                        'selected',
                        'Selected Pages',
                        selectedPageIds.size + ' Selected',
                        CheckCircle2,
                      ],
                      ['file', 'Specific File', files.length + ' Available', FileText],
                    ] as const
                  ).map(([key, label, sub, Icon]) => (
                    <button
                      key={key}
                      type="button"
                      disabled={key === 'selected' && selectedPageIds.size === 0}
                      onClick={() => setTargetSource(key)}
                      className={`flex cursor-pointer flex-col gap-1 rounded-xl border p-3 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 disabled:cursor-not-allowed disabled:opacity-40 ${
                        targetSource === key
                          ? 'border-teal-700 bg-teal-50/50 text-teal-950 ring-2 ring-teal-100'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                      }`}
                    >
                      <Icon
                        className={`mb-1 h-4 w-4 ${
                          key === 'selected' ? 'text-emerald-600' : 'text-teal-700'
                        }`}
                      />
                      <span className="text-xs font-bold">{label}</span>
                      <span className="text-[10px] text-slate-500">{sub}</span>
                    </button>
                  ))}
                </div>
                {targetSource === 'file' && files.length > 0 && (
                  <select
                    value={selectedFileId}
                    onChange={(e) => setSelectedFileId(e.target.value)}
                    className="mt-2.5 w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-600"
                  >
                    {files.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name} ({f.pageCount} pages)
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="space-y-2 rounded-xl border border-slate-200/80 bg-slate-50 p-4">
                <h4 className="flex items-center gap-1.5 text-xs font-extrabold text-slate-800">
                  <Sparkles className="h-4 w-4 text-teal-700" /> Automated High-Fidelity
                  Conversion
                </h4>
                <p className="text-[11px] leading-relaxed text-slate-600">
                  Detects structure, extracts formatting, preserves tables, and applies OCR on
                  scanned pages when needed.
                </p>
              </div>

              <div className="flex items-center justify-between gap-3 pt-2">
                <span className="text-xs font-medium text-slate-500">
                  {pageItems.length} {pageItems.length === 1 ? 'page' : 'pages'} ready
                </span>
                <button
                  type="button"
                  onClick={handleStartConversion}
                  className="flex cursor-pointer items-center gap-2 rounded-xl bg-teal-700 px-6 py-2.5 text-xs font-bold text-white shadow-md transition-all hover:bg-teal-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                >
                  <FileType className="h-4 w-4" /> Convert to Word (.docx)
                </button>
              </div>
            </div>
          ) : isConverting ? (
            <div className="flex flex-col items-center py-10 text-center">
              <Loader2 className="mb-4 h-12 w-12 animate-spin text-teal-700" />
              <h4 className="text-base font-extrabold text-slate-900">Converting…</h4>
              {currentProgress.total > 0 && (
                <div className="mt-5 h-2 w-full max-w-xs overflow-hidden rounded-full border border-slate-200 bg-slate-100">
                  <div
                    className="h-2 rounded-full bg-teal-700 transition-all duration-300"
                    style={{
                      width: `${Math.min(
                        100,
                        Math.round((currentProgress.current / currentProgress.total) * 100)
                      )}%`,
                    }}
                  />
                </div>
              )}
              <span className="mt-4 max-w-full truncate rounded-full border border-teal-100 bg-teal-50 px-3.5 py-1 text-[11px] font-bold text-teal-800">
                {progressMsg || 'Processing…'}
              </span>
            </div>
          ) : conversionError ? (
            <div className="flex flex-col items-center py-6 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-red-100 bg-red-50 text-red-600">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <h4 className="text-base font-extrabold text-slate-900">
                Conversion Couldn&apos;t Complete
              </h4>
              <p className="mt-1 max-w-xs text-xs text-slate-500">{conversionError}</p>
              <div className="mt-5 flex w-full gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 rounded-xl bg-slate-100 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleStartConversion}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-teal-700 py-2.5 text-xs font-bold text-white hover:bg-teal-800"
                >
                  <RefreshCw className="h-3.5 w-3.5" /> Retry
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center py-6 text-center">
              <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-100 bg-emerald-50 text-emerald-600">
                <FileCheck className="h-7 w-7" />
              </div>
              <h4 className="text-lg font-extrabold text-slate-900">Conversion Complete</h4>
              {convertedDocx && (
                <div className="my-5 flex w-full items-center gap-3.5 rounded-xl border border-slate-200/80 bg-slate-50 p-4 text-left">
                  <div className="shrink-0 rounded-lg bg-teal-100 p-2.5 text-teal-800">
                    <FileType className="h-6 w-6" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold text-slate-800">
                      {convertedDocx.fileName}
                    </p>
                    <p className="text-[10px] font-medium text-slate-500">
                      Word Document · {formatBytes(convertedDocx.size)}
                    </p>
                  </div>
                </div>
              )}
              <div className="grid w-full grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl bg-slate-100 px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-200"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={handleDownloadDocx}
                  className="flex items-center justify-center gap-1.5 rounded-xl bg-teal-700 px-4 py-2.5 text-xs font-bold text-white shadow-md hover:bg-teal-800"
                >
                  <Download className="h-4 w-4" /> Download Again
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
