'use client';

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  RotateCw, 
  RotateCcw, 
  Trash2, 
  Copy, 
  CheckSquare, 
  Square, 
  X, 
  ArrowRightLeft,
  ChevronRight,
  FileType
} from 'lucide-react';

interface BulkControlsProps {
  selectedCount: number;
  totalCount: number;
  onRotateSelected: (degrees: number) => void;
  onDeleteSelected: () => void;
  onDuplicateSelected: () => void;
  onDeselectAll: () => void;
  onSelectAll: () => void;
  onMoveSelectedTo: (targetIndex: number) => void;
  onConvertToWord?: () => void;
}

export default function BulkControls({
  selectedCount,
  totalCount,
  onRotateSelected,
  onDeleteSelected,
  onDuplicateSelected,
  onDeselectAll,
  onSelectAll,
  onMoveSelectedTo,
  onConvertToWord,
}: BulkControlsProps) {
  const [showMoveInput, setShowMoveInput] = useState(false);
  const [targetIndexString, setTargetIndexString] = useState('1');

  if (selectedCount === 0) return null;

  const handleMoveSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const target = parseInt(targetIndexString, 10);
    if (!isNaN(target) && target >= 1 && target <= totalCount) {
      onMoveSelectedTo(target - 1);
      setShowMoveInput(false);
    } else {
      setTargetIndexString('1');
    }
  };

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-full max-w-2xl px-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 bg-slate-900 text-white rounded-2xl shadow-2xl border border-slate-800">
        
        {/* Count & Toggle Selection */}
        <div className="flex items-center gap-3">
          <button
            id="btn-bulk-toggle"
            onClick={selectedCount === totalCount ? onDeselectAll : onSelectAll}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            {selectedCount === totalCount ? (
              <>
                <CheckSquare className="h-4 w-4 text-teal-500" />
                Deselect All
              </>
            ) : (
              <>
                <Square className="h-4 w-4 text-slate-400" />
                Select All
              </>
            )}
          </button>
          
          <div className="h-4 w-px bg-slate-700" />
          
          <span className="text-xs font-bold bg-teal-600/20 text-teal-500 px-2.5 py-1 rounded-full border border-teal-600/30">
            {selectedCount} of {totalCount} selected
          </span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Rotate CCW */}
          <button
            id="btn-bulk-rotate-ccw"
            onClick={() => onRotateSelected(-90)}
            title="Rotate Selected Left"
            className="p-2 rounded-xl hover:bg-slate-800 text-slate-300 hover:text-white transition-colors flex items-center justify-center gap-1 cursor-pointer"
          >
            <RotateCcw className="h-4 w-4" />
            <span className="hidden sm:inline text-xs font-semibold">Rotate L</span>
          </button>

          {/* Rotate CW */}
          <button
            id="btn-bulk-rotate-cw"
            onClick={() => onRotateSelected(90)}
            title="Rotate Selected Right"
            className="p-2 rounded-xl hover:bg-slate-800 text-slate-300 hover:text-white transition-colors flex items-center justify-center gap-1 cursor-pointer"
          >
            <RotateCw className="h-4 w-4" />
            <span className="hidden sm:inline text-xs font-semibold">Rotate R</span>
          </button>

          {/* Duplicate */}
          <button
            id="btn-bulk-duplicate"
            onClick={onDuplicateSelected}
            title="Duplicate Selected Pages"
            className="p-2 rounded-xl hover:bg-slate-800 text-slate-300 hover:text-white transition-colors flex items-center justify-center gap-1 cursor-pointer"
          >
            <Copy className="h-4 w-4" />
            <span className="hidden sm:inline text-xs font-semibold">Clone</span>
          </button>

          {/* Move Selected */}
          <div className="relative">
            {showMoveInput ? (
              <form onSubmit={handleMoveSubmit} className="flex items-center gap-1.5 bg-slate-800 rounded-xl p-1 border border-slate-700">
                <span className="text-[10px] font-bold text-slate-400 px-1">To Pos:</span>
                <input
                  type="text"
                  value={targetIndexString}
                  onChange={(e) => setTargetIndexString(e.target.value)}
                  className="w-11 text-center bg-slate-900 border border-slate-700 rounded-lg text-white text-xs px-1 py-1 focus:outline-none focus:border-teal-600"
                  autoFocus
                  onBlur={() => {
                    setTimeout(() => setShowMoveInput(false), 300);
                  }}
                />
                <button
                  type="submit"
                  className="p-1 text-xs bg-teal-700 text-white rounded-lg hover:bg-teal-600"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </form>
            ) : (
              <button
                id="btn-bulk-move"
                onClick={() => setShowMoveInput(true)}
                title="Move selected to specific position"
                className="p-2 rounded-xl hover:bg-slate-800 text-slate-300 hover:text-white transition-colors flex items-center justify-center gap-1 cursor-pointer"
              >
                <ArrowRightLeft className="h-4 w-4" />
                <span className="hidden sm:inline text-xs font-semibold">Relocate</span>
              </button>
            )}
          </div>

          {/* Convert Selected to Word */}
          {onConvertToWord && (
            <button
              id="btn-bulk-convert-word"
              onClick={onConvertToWord}
              title="Convert selected pages to Microsoft Word document"
              className="p-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold transition-all flex items-center justify-center gap-1 cursor-pointer hover:scale-102 shadow-sm"
            >
              <FileType className="h-4 w-4" />
              <span className="hidden sm:inline text-xs">To Word</span>
            </button>
          )}

          <div className="h-4 w-px bg-slate-700" />

          {/* Delete Selected */}
          <button
            id="btn-bulk-delete"
            onClick={onDeleteSelected}
            title="Delete Selected Pages"
            className="p-2 rounded-xl bg-red-600 hover:bg-red-700 text-white transition-all flex items-center justify-center gap-1 cursor-pointer hover:scale-102"
          >
            <Trash2 className="h-4 w-4" />
            <span className="hidden sm:inline text-xs font-bold">Delete</span>
          </button>

          {/* Close Menu */}
          <button
            id="btn-bulk-close"
            onClick={onDeselectAll}
            title="Cancel Selection"
            className="p-2 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

      </div>
    </div>
  );
}
