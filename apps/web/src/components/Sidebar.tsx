'use client';

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  FileText, 
  Trash2, 
  Plus, 
  ShieldAlert, 
  Layers, 
  FilePlus2,
  Trash,
  FileType,
  Sparkles,
  Image as ImageIcon,
  Palette,
  Check,
  X
} from 'lucide-react';
import { PDFFile } from '@/lib/types';
import { getColorOption, COLOR_PALETTE } from '@/lib/pdf/colorPalette';

interface SidebarProps {
  files: PDFFile[];
  onRemoveFile: (id: string) => void;
  onClearAll: () => void;
  onAddBlankEnd: () => void;
  onUploadClick: () => void;
  onConvertToWord?: () => void;
  currentWorkspacePages: number;
  onUpdateFileColor?: (fileId: string, color: string) => void;
}

export default function Sidebar({
  files,
  onRemoveFile,
  onClearAll,
  onAddBlankEnd,
  onUploadClick,
  onConvertToWord,
  currentWorkspacePages,
  onUpdateFileColor,
}: SidebarProps) {
  const [activeColorPickerId, setActiveColorPickerId] = useState<string | null>(null);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = 1;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  const totalBytes = files.reduce((acc, f) => acc + f.size, 0);

  return (
    <div className="w-full lg:w-72 shrink-0 flex flex-col gap-5 bg-white border border-slate-200 p-5 rounded-2xl shadow-sm lg:sticky lg:top-20 lg:self-start lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto custom-scrollbar">
      {/* Workspace Statistics */}
      <div className="flex flex-col gap-3.5 bg-slate-50 border border-slate-150 p-4 rounded-xl">
        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
          <Layers className="h-3.5 w-3.5 text-slate-500" /> Workspace Stats
        </h3>
        <div className="grid grid-cols-2 gap-3 pt-1">
          <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Source Files</span>
            <span className="text-lg font-extrabold text-slate-800">{files.length}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Total Pages</span>
            <span className="text-lg font-extrabold text-slate-800">{currentWorkspacePages}</span>
          </div>
          <div className="flex flex-col col-span-2 border-t border-slate-200 pt-2.5">
            <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Total Input Size</span>
            <span className="text-sm font-semibold text-slate-700">{formatBytes(totalBytes)}</span>
          </div>
        </div>
      </div>

      {/* Global Controls */}
      <div className="flex flex-col gap-2">
        <button
          id="btn-sidebar-upload"
          onClick={onUploadClick}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold rounded-xl shadow-xs hover:shadow transition-all cursor-pointer"
        >
          <FilePlus2 className="h-4 w-4" /> Add PDFs & Images
        </button>

        {onConvertToWord && (
          <button
            id="btn-sidebar-convert-word"
            onClick={onConvertToWord}
            disabled={currentWorkspacePages === 0}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-50 border border-blue-200 hover:bg-blue-100 text-blue-800 text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-40 disabled:hover:bg-blue-50 group"
          >
            <FileType className="h-4 w-4 text-blue-600 group-hover:scale-110 transition-transform" />
            Convert to Word (.docx)
            <Sparkles className="h-3 w-3 text-amber-500 ml-auto" />
          </button>
        )}

        <div className="grid grid-cols-2 gap-2">
          <button
            id="btn-sidebar-add-blank"
            onClick={onAddBlankEnd}
            className="flex items-center justify-center gap-1.5 px-3 py-2 bg-white border border-slate-200 hover:border-slate-300 text-slate-700 text-xs font-semibold rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" /> Blank Page
          </button>
          <button
            id="btn-sidebar-clear"
            onClick={onClearAll}
            disabled={files.length === 0 && currentWorkspacePages === 0}
            className="flex items-center justify-center gap-1.5 px-3 py-2 bg-white border border-red-100 hover:border-red-200 text-red-600 hover:text-red-700 text-xs font-semibold rounded-xl hover:bg-red-50/50 transition-colors disabled:opacity-40 disabled:hover:bg-transparent cursor-pointer"
          >
            <Trash className="h-3.5 w-3.5" /> Clear All
          </button>
        </div>
      </div>

      {/* Uploaded Files Manager */}
      <div className="flex-1 flex flex-col min-h-[260px] lg:min-h-[320px]">
        <div className="flex items-center justify-between mb-2.5">
          <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5 text-slate-500" /> Uploaded Files ({files.length})
          </h3>
          {files.length > 0 && (
            <span className="text-[10px] text-slate-400 font-medium">
              Click palette to edit color
            </span>
          )}
        </div>
        
        {files.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6 border border-dashed border-slate-200 bg-slate-50/50 rounded-xl min-h-[180px]">
            <FileText className="h-9 w-9 text-slate-300 stroke-1 mb-2" />
            <span className="text-xs font-semibold text-slate-500 leading-tight">No files uploaded yet</span>
            <span className="text-[10px] text-slate-400 max-w-[170px] mt-1.5">Upload PDFs or images to start managing and merging pages.</span>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto max-h-[380px] lg:max-h-[480px] space-y-2.5 pr-1 custom-scrollbar">
            {files.map((file) => {
              const fileColorOpt = getColorOption(file.color);
              const isImg = file.fileType === 'image';
              const isPickerOpen = activeColorPickerId === file.id;

              return (
                <div 
                  key={file.id}
                  className={`relative flex flex-col p-3 border rounded-xl shadow-xs transition-all bg-white ${fileColorOpt.sidebarBorder} hover:shadow-sm ${
                    isPickerOpen ? 'z-40 ring-2 ring-teal-600/30' : 'z-10'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div className={`p-2 rounded-lg shrink-0 border ${fileColorOpt.sidebarBg} ${fileColorOpt.sidebarText} ${fileColorOpt.sidebarBorder}`}>
                        {isImg ? <ImageIcon className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-slate-700 truncate" title={file.name}>
                          {file.name}
                        </p>
                        <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                          {isImg ? 'Image' : `${file.pageCount} ${file.pageCount === 1 ? 'page' : 'pages'}`} • {formatBytes(file.size)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* Color Selector Button */}
                      <button
                        id={`btn-color-picker-${file.id}`}
                        type="button"
                        onClick={() => setActiveColorPickerId(prev => prev === file.id ? null : file.id)}
                        title={`Change color for ${file.name} (Current: ${fileColorOpt.label})`}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-bold border transition-all cursor-pointer hover:scale-105 shadow-2xs ${fileColorOpt.sidebarBg} ${fileColorOpt.sidebarText} ${fileColorOpt.sidebarBorder}`}
                      >
                        <span className="w-2.5 h-2.5 rounded-full shrink-0 shadow-xs ring-1 ring-black/10" style={{ backgroundColor: fileColorOpt.hex }} />
                        <span className="hidden sm:inline max-w-[60px] truncate">{fileColorOpt.label}</span>
                        <Palette className="h-3 w-3 opacity-70" />
                      </button>

                      {/* Remove File Button */}
                      <button
                        id={`btn-remove-file-${file.id}`}
                        onClick={() => onRemoveFile(file.id)}
                        title={`Remove ${file.name} and all its pages`}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Popover Color Selector Grid */}
                  {isPickerOpen && (
                    <>
                      {/* Click outside backdrop */}
                      <div 
                        className="fixed inset-0 z-40 bg-transparent"
                        onClick={() => setActiveColorPickerId(null)}
                      />
                      
                      <div className="relative z-50 mt-3 p-3 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl animate-in fade-in zoom-in-95 duration-150">
                        <div className="flex items-center justify-between mb-2.5 px-0.5">
                          <span className="text-[10px] font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                            <Palette className="h-3.5 w-3.5 text-teal-500" /> Choose File Color
                          </span>
                          <button
                            type="button"
                            onClick={() => setActiveColorPickerId(null)}
                            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        <div className="grid grid-cols-5 gap-2 pt-0.5">
                          {COLOR_PALETTE.map((opt) => {
                            const isSelected = file.color === opt.id;
                            return (
                              <button
                                key={opt.id}
                                id={`btn-select-color-${file.id}-${opt.id}`}
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (onUpdateFileColor) {
                                    onUpdateFileColor(file.id, opt.id);
                                  }
                                  setActiveColorPickerId(null);
                                }}
                                title={`${opt.label}`}
                                className={`group relative h-7 w-7 rounded-full flex items-center justify-center transition-all cursor-pointer hover:scale-115 ${
                                  isSelected ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-900 scale-110 shadow-md' : 'hover:opacity-100 opacity-90'
                                }`}
                                style={{ backgroundColor: opt.hex }}
                              >
                                {isSelected && <Check className="h-3.5 w-3.5 text-white drop-shadow-md font-extrabold" />}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Preservation Mode Block & Info */}
      <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
        <h4 className="text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
          <ShieldAlert className="h-3.5 w-3.5 text-teal-700" /> Preservation Mode
        </h4>
        <p className="text-[11px] text-slate-500 leading-relaxed">
          Original resolution, embedded fonts, and vector data are kept fully intact. No quality loss will occur during page assembly.
        </p>
      </div>
    </div>
  );
}

