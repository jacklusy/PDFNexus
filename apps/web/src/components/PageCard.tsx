'use client';

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, memo } from 'react';
import { 
  RotateCw, 
  RotateCcw, 
  Trash2, 
  Copy, 
  Plus, 
  MoveRight, 
  MoveLeft, 
  GripVertical, 
  FileText,
  ChevronRight,
  ArrowRightLeft,
  Image as ImageIcon,
  Eye
} from 'lucide-react';
import { PDFPageItem } from '@/lib/types';
import { getColorOption } from '@/lib/pdf/colorPalette';

interface PageCardProps {
  key?: string;
  page: PDFPageItem;
  index: number;
  isSelected: boolean;
  onSelect: (id: string, shiftKey: boolean) => void;
  onRotate: (id: string, degrees: number) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onInsertBlank: (id: string, position: 'before' | 'after') => void;
  onInsertImage?: (pageId: string, position: 'before' | 'after') => void;
  onPreview?: (page: PDFPageItem) => void;
  onMoveTo: (id: string, targetIndex: number) => void;
  onDragStart: (e: React.DragEvent, index: number) => void;
  onDragOver: (e: React.DragEvent, index: number) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent, targetIndex: number) => void;
  draggedIndex: number | null;
  dragOverIndex: number | null;
  totalPages: number;
  /** Optional override for page.thumbnailUrl (from external Map state) */
  thumbnailUrl?: string;
  onAnnounce?: (message: string) => void;
}

function PageCard({
  page,
  index,
  isSelected,
  onSelect,
  onRotate,
  onDelete,
  onDuplicate,
  onInsertBlank,
  onInsertImage,
  onPreview,
  onMoveTo,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  draggedIndex,
  dragOverIndex,
  totalPages,
  thumbnailUrl: thumbnailUrlProp,
  onAnnounce,
}: PageCardProps) {
  const [showMoveInput, setShowMoveInput] = useState(false);
  const [moveTarget, setMoveTarget] = useState((index + 1).toString());
  const thumbnailUrl =
    thumbnailUrlProp !== undefined ? thumbnailUrlProp : page.thumbnailUrl;

  const handlePreview = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onPreview) onPreview(page);
  };

  const handleRotateCw = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRotate(page.id, 90);
    onAnnounce?.(`Rotated page ${index + 1} clockwise`);
  };

  const handleRotateCcw = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRotate(page.id, -90);
    onAnnounce?.(`Rotated page ${index + 1} counter-clockwise`);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(page.id);
    onAnnounce?.(`Deleted page ${index + 1}`);
  };

  const handleDuplicate = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDuplicate(page.id);
    onAnnounce?.(`Duplicated page ${index + 1}`);
  };

  const handleMoveSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const target = parseInt(moveTarget, 10);
    if (!isNaN(target) && target >= 1 && target <= totalPages) {
      onMoveTo(page.id, target - 1);
      setShowMoveInput(false);
      onAnnounce?.(`Moved page to position ${target}`);
    } else {
      setMoveTarget((index + 1).toString());
    }
  };

  const handleMoveLeft = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (index > 0) {
      onMoveTo(page.id, index - 1);
      onAnnounce?.(`Moved page to position ${index}`);
    }
  };

  const handleMoveRight = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (index < totalPages - 1) {
      onMoveTo(page.id, index + 1);
      onAnnounce?.(`Moved page to position ${index + 2}`);
    }
  };

  const handleCardKeyDown = (e: React.KeyboardEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'BUTTON') {
      return;
    }
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      onSelect(page.id, e.shiftKey);
      return;
    }
    if (e.key === 'ArrowLeft' && (e.altKey || e.metaKey)) {
      e.preventDefault();
      if (index > 0) {
        onMoveTo(page.id, index - 1);
        onAnnounce?.(`Moved page to position ${index}`);
      }
      return;
    }
    if (e.key === 'ArrowRight' && (e.altKey || e.metaKey)) {
      e.preventDefault();
      if (index < totalPages - 1) {
        onMoveTo(page.id, index + 1);
        onAnnounce?.(`Moved page to position ${index + 2}`);
      }
      return;
    }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      onDelete(page.id);
      onAnnounce?.(`Deleted page ${index + 1}`);
    }
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onSelect(page.id, (e.nativeEvent as MouseEvent).shiftKey);
  };

  const isDraggingThis = draggedIndex === index;
  const isTargetOfDrag = dragOverIndex === index;
  const colorOpt = getColorOption(page.color);
  const colorStyles = {
    border: colorOpt.cardBorder,
    selectedBorder: colorOpt.cardSelectedBorder,
    badgeBg: colorOpt.cardBadgeBg,
    badgeText: colorOpt.cardBadgeText,
    accentBar: colorOpt.cardAccentBar,
    bgLight: colorOpt.cardBgLight,
  };

  return (
    <div
      id={`page-card-${page.id}`}
      role="option"
      aria-selected={isSelected}
      aria-label={`Page ${index + 1} of ${totalPages}${page.isBlank ? ', blank' : ''}${isSelected ? ', selected' : ''}`}
      tabIndex={0}
      draggable
      onKeyDown={handleCardKeyDown}
      onDragStart={(e) => onDragStart(e, index)}
      onDragOver={(e) => onDragOver(e, index)}
      onDragLeave={onDragLeave}
      onDrop={(e) => onDrop(e, index)}
      className={`group relative flex flex-col rounded-xl border bg-white shadow-xs transition-all duration-200 select-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:outline-none ${
        isSelected 
          ? colorStyles.selectedBorder 
          : `${colorStyles.border} hover:shadow-md`
      } ${isDraggingThis ? 'opacity-40 scale-95' : 'opacity-100'} ${
        isTargetOfDrag ? 'scale-102 z-10 shadow-lg' : ''
      }`}
    >
      {/* Visual Drag Insertion Point Indicator */}
      {isTargetOfDrag && (
        <div className={`absolute top-0 bottom-0 w-1 rounded-full z-40 flex items-center justify-center ${
          draggedIndex !== null && draggedIndex < index ? '-right-2' : '-left-2'
        } ${colorStyles.accentBar}`}>
          <div className={`w-3.5 h-3.5 rounded-full ring-4 shadow-md ${colorStyles.accentBar} ring-white`} />
        </div>
      )}

      {/* Top Accent Color Bar */}
      <div className={`h-1.5 w-full rounded-t-xl ${colorStyles.accentBar}`} />

      {/* Top Bar (Checkbox + Page Number + Eye Preview + Grab Handle) */}
      <div className={`flex items-center justify-between px-3 py-1.5 border-b border-slate-100 rounded-t-none ${colorStyles.bgLight}`}>
        <div className="flex items-center gap-2">
          <input
            id={`checkbox-${page.id}`}
            type="checkbox"
            checked={isSelected}
            onChange={handleCheckboxChange}
            onClick={(e) => e.stopPropagation()}
            className="h-4 w-4 rounded-sm border-slate-300 text-teal-700 focus:ring-teal-600 cursor-pointer"
          />
          <span className="text-xs font-semibold text-slate-700">
            Page {index + 1}
          </span>
        </div>
        
        <div className="flex items-center gap-1">
          <button
            id={`btn-eye-preview-top-${page.id}`}
            onClick={handlePreview}
            title="Full-Screen Page Preview"
            className="p-1 text-slate-400 hover:text-teal-700 hover:bg-slate-100/80 rounded transition-colors cursor-pointer"
          >
            <Eye className="h-3.5 w-3.5" />
          </button>
          {/* Grab Handle */}
          <div className="cursor-grab text-slate-400 hover:text-slate-600 active:cursor-grabbing p-0.5 rounded hover:bg-slate-100">
            <GripVertical className="h-3.5 w-3.5" />
          </div>
        </div>
      </div>

      {/* Thumbnail Area */}
      <div 
        onClick={(e) => onSelect(page.id, e.shiftKey)}
        className="relative flex items-center justify-center p-4 bg-slate-50/50 aspect-[3/4] overflow-hidden cursor-pointer group-hover:bg-slate-100/10 transition-colors"
      >
        {/* Thumbnail Preview with rotation applied */}
        <div 
          className="relative transition-transform duration-200 ease-out shadow-sm max-w-full max-h-full flex items-center justify-center"
          style={{ transform: `rotate(${page.rotation}deg)` }}
        >
          {page.isBlank ? (
            <div className="w-28 h-36 border-2 border-dashed border-slate-200 bg-white rounded flex flex-col items-center justify-center text-slate-400 text-center p-2">
              <FileText className="h-6 w-6 stroke-1 mb-1" />
              <span className="text-[10px] font-medium leading-tight">Blank Page</span>
            </div>
          ) : thumbnailUrl === undefined ? (
            /* Clean Static Skeleton Placeholder */
            <div className="w-28 h-36 border border-slate-200/80 bg-slate-50/80 rounded flex flex-col items-center justify-center text-slate-300">
              <FileText className="h-6 w-6 stroke-1 mb-1 text-slate-300" />
              <span className="text-[10px] font-semibold text-slate-400">Page {index + 1}</span>
            </div>
          ) : thumbnailUrl === '' ? (
            /* Failed to Render Fallback */
            <div className="w-28 h-36 border border-slate-150 bg-white rounded flex flex-col items-center justify-center text-slate-400 p-3 text-center">
              <FileText className="h-8 w-8 text-slate-300 mb-1" />
              <span className="text-[9px] font-semibold text-slate-500 truncate w-full">
                {page.originalFileName}
              </span>
              <span className="text-[9px] text-slate-400">
                P. {page.originalPageNumber}
              </span>
            </div>
          ) : (
            /* High Quality Rendered Thumbnail */
            <img
              id={`thumbnail-img-${page.id}`}
              src={thumbnailUrl}
              alt={`Page ${index + 1}`}
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
              className="max-h-36 max-w-[110px] object-contain rounded border border-slate-200 bg-white pointer-events-none select-none transition-opacity duration-200"
            />
          )}
        </div>

        {/* Hover Action Overlays */}
        <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-slate-900/85 to-transparent flex justify-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-10">
          <button
            id={`btn-eye-preview-hover-${page.id}`}
            onClick={handlePreview}
            title="Full-Screen Preview"
            className="p-1.5 rounded-lg bg-white/95 text-slate-700 hover:bg-white hover:text-teal-700 shadow-sm transition-all hover:scale-105 cursor-pointer"
          >
            <Eye className="h-3.5 w-3.5" />
          </button>
          <button
            id={`btn-rotate-ccw-${page.id}`}
            onClick={handleRotateCcw}
            title="Rotate Left (-90°)"
            className="p-1.5 rounded-lg bg-white/95 text-slate-700 hover:bg-white hover:text-teal-700 shadow-sm transition-all hover:scale-105 cursor-pointer"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
          <button
            id={`btn-rotate-cw-${page.id}`}
            onClick={handleRotateCw}
            title="Rotate Right (+90°)"
            className="p-1.5 rounded-lg bg-white/95 text-slate-700 hover:bg-white hover:text-teal-700 shadow-sm transition-all hover:scale-105 cursor-pointer"
          >
            <RotateCw className="h-3.5 w-3.5" />
          </button>
          <button
            id={`btn-duplicate-${page.id}`}
            onClick={handleDuplicate}
            title="Duplicate Page"
            className="p-1.5 rounded-lg bg-white/95 text-slate-700 hover:bg-white hover:text-teal-700 shadow-sm transition-all hover:scale-105 cursor-pointer"
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
          <button
            id={`btn-delete-${page.id}`}
            onClick={handleDelete}
            title="Delete Page"
            className="p-1.5 rounded-lg bg-red-600 text-white hover:bg-red-700 shadow-sm transition-all hover:scale-105 cursor-pointer"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Info Bar (Original file context) */}
      <div className="p-2.5 border-t border-slate-100 flex flex-col gap-1.5 bg-white rounded-b-xl relative">
        <div className="flex items-center justify-between gap-1.5">
          <div 
            className={`text-[10px] font-bold px-2 py-0.5 rounded-md border truncate flex-1 flex items-center gap-1 ${colorStyles.badgeBg} ${colorStyles.badgeText}`}
            title={page.isBlank ? 'Blank Page' : `${page.originalFileName}`}
          >
            {page.isImage && <ImageIcon className="h-3 w-3 shrink-0" />}
            <span className="truncate">{page.isBlank ? 'Blank Page' : page.originalFileName}</span>
          </div>
          {!page.isBlank && (
            <span className="text-[10px] text-slate-400 font-mono shrink-0 bg-slate-50 border border-slate-100 px-1.5 py-0.5 rounded">
              {page.isImage ? 'IMAGE' : `P. ${page.originalPageNumber}`}
            </span>
          )}
        </div>

        {/* Move controls: Left, Right, Jump */}
        <div className="flex items-center justify-between gap-1 pt-1 border-t border-slate-50">
          <div className="flex items-center gap-1">
            <button
              id={`btn-move-left-${page.id}`}
              onClick={handleMoveLeft}
              disabled={index === 0}
              title="Move Page Left"
              className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer"
            >
              <MoveLeft className="h-3.5 w-3.5" />
            </button>
            <button
              id={`btn-move-right-${page.id}`}
              onClick={handleMoveRight}
              disabled={index === totalPages - 1}
              title="Move Page Right"
              className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer"
            >
              <MoveRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="relative">
            {showMoveInput ? (
              <form onSubmit={handleMoveSubmit} className="flex items-center gap-1">
                <input
                  type="text"
                  value={moveTarget}
                  onChange={(e) => setMoveTarget(e.target.value)}
                  className="w-10 text-center text-xs border border-teal-500 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-teal-600"
                  autoFocus
                  onBlur={() => {
                    setTimeout(() => setShowMoveInput(false), 200);
                  }}
                />
                <button
                  type="submit"
                  className="p-1 text-xs bg-teal-700 text-white rounded hover:bg-teal-800 cursor-pointer"
                >
                  <ChevronRight className="h-3 w-3" />
                </button>
              </form>
            ) : (
              <button
                id={`btn-show-move-${page.id}`}
                onClick={() => setShowMoveInput(true)}
                title="Move page to specific position"
                className="text-[10px] text-teal-700 hover:text-teal-900 font-medium px-1.5 py-0.5 rounded hover:bg-teal-50 flex items-center gap-0.5 cursor-pointer"
              >
                <ArrowRightLeft className="h-2.5 w-2.5" /> Position
              </button>
            )}
          </div>
        </div>

        {/* Inline Insert Shortcuts (Only visible on card hover) */}
        <div className="absolute top-1/2 -left-3 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity z-20 pointer-events-none group-hover:pointer-events-auto flex flex-col gap-1">
          <button
            id={`btn-insert-blank-before-${page.id}`}
            onClick={(e) => { e.stopPropagation(); onInsertBlank(page.id, 'before'); }}
            title="Insert Blank Page Before"
            className="flex items-center justify-center w-5.5 h-5.5 rounded-full bg-slate-700 text-white hover:bg-slate-900 shadow-md transform hover:scale-110 transition-transform cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
          {onInsertImage && (
            <button
              id={`btn-insert-image-before-${page.id}`}
              onClick={(e) => { e.stopPropagation(); onInsertImage(page.id, 'before'); }}
              title="Insert Image Before"
              className="flex items-center justify-center w-5.5 h-5.5 rounded-full bg-teal-700 text-white hover:bg-teal-800 shadow-md transform hover:scale-110 transition-transform cursor-pointer"
            >
              <ImageIcon className="h-3 w-3" />
            </button>
          )}
        </div>
        <div className="absolute top-1/2 -right-3 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity z-20 pointer-events-none group-hover:pointer-events-auto flex flex-col gap-1">
          <button
            id={`btn-insert-blank-after-${page.id}`}
            onClick={(e) => { e.stopPropagation(); onInsertBlank(page.id, 'after'); }}
            title="Insert Blank Page After"
            className="flex items-center justify-center w-5.5 h-5.5 rounded-full bg-slate-700 text-white hover:bg-slate-900 shadow-md transform hover:scale-110 transition-transform cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
          {onInsertImage && (
            <button
              id={`btn-insert-image-after-${page.id}`}
              onClick={(e) => { e.stopPropagation(); onInsertImage(page.id, 'after'); }}
              title="Insert Image After"
              className="flex items-center justify-center w-5.5 h-5.5 rounded-full bg-teal-700 text-white hover:bg-teal-800 shadow-md transform hover:scale-110 transition-transform cursor-pointer"
            >
              <ImageIcon className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default memo(PageCard);
