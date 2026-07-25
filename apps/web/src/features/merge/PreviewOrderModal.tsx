'use client';

import React, { useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Download, FileText, Image as ImageIcon, ListOrdered, X } from 'lucide-react';
import type { PDFPageItem } from '@/lib/types';

const ROW_ESTIMATE = 72;

export interface PreviewOrderModalProps {
  open: boolean;
  pages: PDFPageItem[];
  thumbnailsByPageId: Map<string, string>;
  onClose: () => void;
  onMerge: () => void;
}

function resolveThumb(
  page: PDFPageItem,
  thumbnailsByPageId: Map<string, string>
): string | undefined {
  if (thumbnailsByPageId.has(page.id)) return thumbnailsByPageId.get(page.id);
  return page.thumbnailUrl;
}

export function PreviewOrderModal({
  open,
  pages,
  thumbnailsByPageId,
  onClose,
  onMerge,
}: PreviewOrderModalProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: pages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_ESTIMATE,
    overscan: 8,
    enabled: open && pages.length > 40,
  });

  const useVirtual = open && pages.length > 40;

  const renderRow = (p: PDFPageItem, idx: number) => {
    const thumb = resolveThumb(p, thumbnailsByPageId);
    return (
      <div
        key={p.id}
        className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200/80 rounded-xl gap-3 hover:bg-slate-100/50 transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="w-8 h-8 shrink-0 bg-teal-700 text-white font-extrabold text-xs rounded-lg flex items-center justify-center shadow-xs">
            {idx + 1}
          </span>
          <div className="w-10 h-12 shrink-0 bg-white border border-slate-200 rounded flex items-center justify-center overflow-hidden shadow-2xs">
            {thumb ? (
              <img
                src={thumb}
                alt={`P. ${idx + 1}`}
                className="w-full h-full object-contain"
                style={{ transform: `rotate(${p.rotation}deg)` }}
              />
            ) : p.isBlank ? (
              <FileText className="h-5 w-5 text-slate-300" />
            ) : p.isImage ? (
              <ImageIcon className="h-5 w-5 text-teal-500" />
            ) : (
              <FileText className="h-5 w-5 text-slate-400" />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-800 truncate">
                {p.isBlank ? 'Blank Page' : p.originalFileName}
              </span>
              <span
                className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase ${
                  p.isBlank
                    ? 'bg-slate-100 text-slate-600 border-slate-200'
                    : p.isImage
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-teal-50 text-teal-800 border-teal-200'
                }`}
              >
                {p.isBlank ? 'BLANK' : p.isImage ? 'IMAGE' : 'PDF PAGE'}
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-medium mt-0.5">
              {!p.isBlank && !p.isImage && `Source Page ${p.originalPageNumber} • `}
              Rotation: {p.rotation}°
            </p>
          </div>
        </div>
        <div className="text-[11px] font-mono text-slate-400 shrink-0">Index {idx + 1}</div>
      </div>
    );
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-50 flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ scale: 0.95, y: 15 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 15 }}
            className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col border border-slate-200 overflow-hidden"
          >
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-teal-50 text-teal-700 rounded-xl border border-teal-100">
                  <ListOrdered className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
                    Final Page Order Sequence
                  </h3>
                  <p className="text-xs text-slate-500">
                    {pages.length} total {pages.length === 1 ? 'page' : 'pages'} ready to merge
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div
              ref={parentRef}
              className="p-5 overflow-y-auto flex-1 custom-scrollbar"
            >
              {useVirtual ? (
                <div
                  style={{
                    height: `${rowVirtualizer.getTotalSize()}px`,
                    width: '100%',
                    position: 'relative',
                  }}
                >
                  {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                    const p = pages[virtualRow.index];
                    if (!p) return null;
                    return (
                      <div
                        key={virtualRow.key}
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: '100%',
                          height: `${virtualRow.size}px`,
                          transform: `translateY(${virtualRow.start}px)`,
                          paddingBottom: 10,
                        }}
                      >
                        {renderRow(p, virtualRow.index)}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-2.5">
                  {pages.map((p, idx) => renderRow(p, idx))}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl transition-all cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={onMerge}
                className="flex items-center gap-1.5 px-5 py-2 bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer"
              >
                <Download className="h-3.5 w-3.5" /> Merge & Download PDF
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
