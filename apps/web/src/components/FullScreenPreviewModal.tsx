'use client';

import React, { useState, useEffect } from 'react';
import { 
  X, 
  ChevronLeft, 
  ChevronRight, 
  ZoomIn, 
  ZoomOut, 
  RotateCw, 
  RotateCcw, 
  FileText, 
  Loader2
} from 'lucide-react';
import { motion } from 'motion/react';
import { PDFPageItem, FileStore } from '@/lib/types';
import { renderPageHighResPreview } from '@/lib/pdf/pdfHelpers';

interface FullScreenPreviewModalProps {
  page: PDFPageItem | null;
  pageIndex: number;
  totalPages: number;
  fileStore: FileStore;
  onClose: () => void;
  onNavigate: (newIndex: number) => void;
  onRotate: (id: string, degrees: number) => void;
}

export const FullScreenPreviewModal: React.FC<FullScreenPreviewModalProps> = ({
  page,
  pageIndex,
  totalPages,
  fileStore,
  onClose,
  onNavigate,
  onRotate,
}) => {
  const [zoomLevel, setZoomLevel] = useState(1.0);
  const [highResUrl, setHighResUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!page) return;
    let isMounted = true;
    setIsLoading(true);

    renderPageHighResPreview(page, fileStore)
      .then((url) => {
        if (isMounted) {
          setHighResUrl(url || page.thumbnailUrl || '');
          setIsLoading(false);
        }
      })
      .catch((err) => {
        console.error('High res preview error:', err);
        if (isMounted) {
          setHighResUrl(page.thumbnailUrl || '');
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [page?.id, page?.originalFileId, page?.originalPageNumber, fileStore]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft' && pageIndex > 0) {
        onNavigate(pageIndex - 1);
      } else if (e.key === 'ArrowRight' && pageIndex < totalPages - 1) {
        onNavigate(pageIndex + 1);
      } else if (e.key === '=' || e.key === '+') {
        setZoomLevel((z) => Math.min(3.0, z + 0.25));
      } else if (e.key === '-') {
        setZoomLevel((z) => Math.max(0.5, z - 0.25));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pageIndex, totalPages, onClose, onNavigate]);

  if (!page) return null;

  const handleZoomIn = () => setZoomLevel((z) => Math.min(3.0, z + 0.25));
  const handleZoomOut = () => setZoomLevel((z) => Math.max(0.5, z - 0.25));
  const handleResetZoom = () => setZoomLevel(1.0);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex flex-col select-none overflow-hidden"
    >
      {/* Top Controls Header */}
      <div className="h-16 px-6 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between text-white shrink-0 z-10">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 bg-teal-700 text-white font-extrabold text-xs rounded-lg shadow-xs">
              Page {pageIndex + 1} of {totalPages}
            </span>
            <span className="text-sm font-bold text-slate-200 truncate max-w-xs">
              {page.isBlank ? 'Blank Page' : page.originalFileName}
            </span>
          </div>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${
            page.isBlank ? 'bg-slate-800 text-slate-400 border-slate-700' : page.isImage ? 'bg-emerald-950/80 text-emerald-400 border-emerald-800' : 'bg-slate-950/80 text-teal-300 border-teal-900'
          }`}>
            {page.isBlank ? 'BLANK' : page.isImage ? 'IMAGE' : `P. ${page.originalPageNumber}`}
          </span>
        </div>

        {/* Toolbar Center Controls */}
        <div className="flex items-center gap-1.5 bg-slate-800/80 border border-slate-700/80 p-1 rounded-xl shadow-inner">
          <button
            id="btn-preview-rotate-ccw"
            onClick={() => onRotate(page.id, -90)}
            title="Rotate Left (-90°)"
            className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
          <button
            id="btn-preview-rotate-cw"
            onClick={() => onRotate(page.id, 90)}
            title="Rotate Right (+90°)"
            className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
          >
            <RotateCw className="h-4 w-4" />
          </button>

          <div className="h-4 w-[1px] bg-slate-700 mx-1" />

          <button
            id="btn-preview-zoom-out"
            onClick={handleZoomOut}
            disabled={zoomLevel <= 0.5}
            title="Zoom Out (-)"
            className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-700 disabled:opacity-40 rounded-lg transition-colors cursor-pointer"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <button
            id="btn-preview-zoom-reset"
            onClick={handleResetZoom}
            title="Reset Zoom"
            className="px-2 py-1 text-xs font-mono font-bold text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
          >
            {Math.round(zoomLevel * 100)}%
          </button>
          <button
            id="btn-preview-zoom-in"
            onClick={handleZoomIn}
            disabled={zoomLevel >= 3.0}
            title="Zoom In (+)"
            className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-700 disabled:opacity-40 rounded-lg transition-colors cursor-pointer"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
        </div>

        {/* Right Close Button */}
        <div className="flex items-center gap-3">
          <button
            id="btn-close-fullscreen-preview"
            onClick={onClose}
            title="Close Preview (Esc)"
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl transition-all cursor-pointer border border-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Main Preview Container */}
      <div className="flex-1 relative flex items-center justify-center p-6 overflow-auto custom-scrollbar">
        {/* Previous Page Arrow Button */}
        <button
          id="btn-preview-prev-page"
          onClick={() => onNavigate(pageIndex - 1)}
          disabled={pageIndex === 0}
          title="Previous Page (Left Arrow)"
          className="absolute left-6 top-1/2 -translate-y-1/2 z-20 p-3 bg-slate-900/80 hover:bg-teal-700 text-white rounded-2xl border border-slate-700/80 shadow-2xl transition-all disabled:opacity-20 disabled:hover:bg-slate-900/80 cursor-pointer"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>

        {/* Next Page Arrow Button */}
        <button
          id="btn-preview-next-page"
          onClick={() => onNavigate(pageIndex + 1)}
          disabled={pageIndex === totalPages - 1}
          title="Next Page (Right Arrow)"
          className="absolute right-6 top-1/2 -translate-y-1/2 z-20 p-3 bg-slate-900/80 hover:bg-teal-700 text-white rounded-2xl border border-slate-700/80 shadow-2xl transition-all disabled:opacity-20 disabled:hover:bg-slate-900/80 cursor-pointer"
        >
          <ChevronRight className="h-6 w-6" />
        </button>

        {/* Image / Blank Page Display */}
        <div className="relative flex items-center justify-center max-w-full max-h-full p-4 transition-all duration-200">
          {isLoading && (
            <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-slate-950/60 backdrop-blur-xs rounded-2xl">
              <Loader2 className="h-10 w-10 text-teal-600 animate-spin mb-2" />
              <span className="text-xs font-semibold text-slate-300">Loading High-Res Page Preview...</span>
            </div>
          )}

          {page.isBlank ? (
            <div 
              style={{ transform: `rotate(${page.rotation}deg) scale(${zoomLevel})` }}
              className="w-[500px] h-[700px] bg-white rounded-lg shadow-2xl flex flex-col items-center justify-center text-slate-400 p-8 border border-slate-200 transition-transform duration-200"
            >
              <FileText className="h-16 w-16 stroke-1 text-slate-300 mb-3" />
              <span className="text-base font-bold text-slate-500">Blank Page</span>
              <span className="text-xs text-slate-400 mt-1">Ready for PDF Assembly</span>
            </div>
          ) : (
            <img
              src={highResUrl || page.thumbnailUrl}
              alt={`Page ${pageIndex + 1}`}
              referrerPolicy="no-referrer"
              style={{ transform: `rotate(${page.rotation}deg) scale(${zoomLevel})` }}
              className="max-h-[82vh] max-w-[85vw] object-contain rounded-lg shadow-2xl border border-slate-800/80 bg-white transition-transform duration-200 select-none"
            />
          )}
        </div>
      </div>

      {/* Bottom Footer Info Bar */}
      <div className="h-12 px-6 bg-slate-900/80 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400 shrink-0">
        <div>
          Use <kbd className="px-1.5 py-0.5 bg-slate-800 rounded border border-slate-700 text-slate-300 font-mono">←</kbd> and <kbd className="px-1.5 py-0.5 bg-slate-800 rounded border border-slate-700 text-slate-300 font-mono">→</kbd> keys to flip pages
        </div>
        <div>
          Rotation: <span className="text-teal-500 font-bold">{page.rotation}°</span> • Zoom: <span className="text-teal-500 font-bold">{Math.round(zoomLevel * 100)}%</span>
        </div>
        <div>
          Press <kbd className="px-1.5 py-0.5 bg-slate-800 rounded border border-slate-700 text-slate-300 font-mono">Esc</kbd> to close
        </div>
      </div>
    </motion.div>
  );
};

export default FullScreenPreviewModal;
