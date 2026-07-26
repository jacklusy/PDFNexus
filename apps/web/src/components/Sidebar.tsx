'use client';

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
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
  X,
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

  useEffect(() => {
    if (!activeColorPickerId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setActiveColorPickerId(null);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [activeColorPickerId]);

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
    <div
      className={`flex w-full shrink-0 flex-col gap-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:w-72 lg:self-start custom-scrollbar ${
        activeColorPickerId ? 'overflow-visible' : 'lg:overflow-y-auto'
      }`}
    >
      <div className="flex flex-col gap-3.5 rounded-xl border border-slate-150 bg-slate-50 p-4">
        <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-slate-400">
          <Layers className="h-3.5 w-3.5 text-slate-500" /> Workspace Stats
        </h3>
        <div className="grid grid-cols-2 gap-3 pt-1">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Source Files
            </span>
            <span className="text-lg font-extrabold text-slate-800">{files.length}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Total Pages
            </span>
            <span className="text-lg font-extrabold text-slate-800">
              {currentWorkspacePages}
            </span>
          </div>
          <div className="col-span-2 flex flex-col border-t border-slate-200 pt-2.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Total Input Size
            </span>
            <span className="text-sm font-semibold text-slate-700">
              {formatBytes(totalBytes)}
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <button
          id="btn-sidebar-upload"
          type="button"
          onClick={onUploadClick}
          className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-xs font-semibold text-white shadow-xs transition-all hover:bg-teal-800 hover:shadow"
        >
          <FilePlus2 className="h-4 w-4" /> Add PDFs & Images
        </button>

        {onConvertToWord && (
          <button
            id="btn-sidebar-convert-word"
            type="button"
            onClick={onConvertToWord}
            disabled={currentWorkspacePages === 0}
            className="group flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-xs font-bold text-blue-800 shadow-xs transition-all hover:bg-blue-100 disabled:opacity-40 disabled:hover:bg-blue-50"
          >
            <FileType className="h-4 w-4 text-blue-600 transition-transform group-hover:scale-110" />
            Convert to Word (.docx)
            <Sparkles className="ml-auto h-3 w-3 text-amber-500" />
          </button>
        )}

        <div className="grid grid-cols-2 gap-2">
          <button
            id="btn-sidebar-add-blank"
            type="button"
            onClick={onAddBlankEnd}
            className="flex cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50"
          >
            <Plus className="h-3.5 w-3.5" /> Blank Page
          </button>
          <button
            id="btn-sidebar-clear"
            type="button"
            onClick={onClearAll}
            disabled={files.length === 0 && currentWorkspacePages === 0}
            className="flex cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-red-100 bg-white px-3 py-2 text-xs font-semibold text-red-600 transition-colors hover:border-red-200 hover:bg-red-50/50 hover:text-red-700 disabled:opacity-40 disabled:hover:bg-transparent"
          >
            <Trash className="h-3.5 w-3.5" /> Clear All
          </button>
        </div>
      </div>

      <div className="flex min-h-[260px] flex-1 flex-col lg:min-h-[320px]">
        <div className="mb-2.5 flex items-center justify-between">
          <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-slate-400">
            <FileText className="h-3.5 w-3.5 text-slate-500" /> Uploaded Files ({files.length})
          </h3>
          {files.length > 0 && (
            <span className="text-[10px] font-medium text-slate-400">
              Click palette to edit color
            </span>
          )}
        </div>

        {files.length === 0 ? (
          <div className="flex min-h-[180px] flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center">
            <FileText className="mb-2 h-9 w-9 stroke-1 text-slate-300" />
            <span className="text-xs font-semibold leading-tight text-slate-500">
              No files uploaded yet
            </span>
            <span className="mt-1.5 max-w-[170px] text-[10px] text-slate-400">
              Upload PDFs or images to start managing and merging pages.
            </span>
          </div>
        ) : (
          <div
            className={`flex-1 space-y-2.5 pr-1 custom-scrollbar ${
              activeColorPickerId
                ? 'overflow-visible'
                : 'max-h-[380px] overflow-y-auto lg:max-h-[480px]'
            }`}
          >
            {files.map((file) => {
              const fileColorOpt = getColorOption(file.color);
              const isImg = file.fileType === 'image';
              const isPickerOpen = activeColorPickerId === file.id;

              return (
                <div
                  key={file.id}
                  className={`relative flex flex-col rounded-xl border bg-white p-3 shadow-xs transition-all hover:shadow-sm ${fileColorOpt.sidebarBorder} ${
                    isPickerOpen ? 'z-50 ring-2 ring-teal-600/30' : 'z-10'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 flex-1 items-center gap-2.5">
                      <div
                        className={`shrink-0 rounded-lg border p-2 ${fileColorOpt.sidebarBg} ${fileColorOpt.sidebarText} ${fileColorOpt.sidebarBorder}`}
                      >
                        {isImg ? (
                          <ImageIcon className="h-4 w-4" />
                        ) : (
                          <FileText className="h-4 w-4" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p
                          className="truncate text-xs font-bold text-slate-700"
                          title={file.name}
                        >
                          {file.name}
                        </p>
                        <p className="mt-0.5 text-[10px] font-medium text-slate-400">
                          {isImg
                            ? 'Image'
                            : `${file.pageCount} ${file.pageCount === 1 ? 'page' : 'pages'}`}{' '}
                          • {formatBytes(file.size)}
                        </p>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-1.5">
                      <button
                        id={`btn-color-picker-${file.id}`}
                        type="button"
                        aria-expanded={isPickerOpen}
                        aria-haspopup="dialog"
                        onClick={() =>
                          setActiveColorPickerId((prev) =>
                            prev === file.id ? null : file.id
                          )
                        }
                        title={`Change color for ${file.name} (Current: ${fileColorOpt.label})`}
                        className={`flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[10px] font-bold shadow-2xs transition-all hover:scale-105 ${fileColorOpt.sidebarBg} ${fileColorOpt.sidebarText} ${fileColorOpt.sidebarBorder}`}
                      >
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full shadow-xs ring-1 ring-black/10"
                          style={{ backgroundColor: fileColorOpt.hex }}
                        />
                        <span className="hidden max-w-[60px] truncate sm:inline">
                          {fileColorOpt.label}
                        </span>
                        <Palette className="h-3 w-3 opacity-70" />
                      </button>

                      <button
                        id={`btn-remove-file-${file.id}`}
                        type="button"
                        onClick={() => onRemoveFile(file.id)}
                        title={`Remove ${file.name} and all its pages`}
                        className="cursor-pointer rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Absolute overlay — does not push the file-list layout */}
                  {isPickerOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-40 bg-transparent"
                        aria-hidden
                        onClick={() => setActiveColorPickerId(null)}
                      />
                      <div
                        role="dialog"
                        aria-label="Choose file color"
                        className="absolute left-0 right-0 top-full z-50 mt-1.5 rounded-xl border border-slate-700 bg-slate-900 p-3 shadow-2xl animate-in fade-in zoom-in-95 duration-150"
                      >
                        <div className="mb-2.5 flex items-center justify-between px-0.5">
                          <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-200">
                            <Palette className="h-3.5 w-3.5 text-teal-500" /> Choose
                            File Color
                          </span>
                          <button
                            type="button"
                            onClick={() => setActiveColorPickerId(null)}
                            aria-label="Close color picker"
                            className="cursor-pointer rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
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
                                  onUpdateFileColor?.(file.id, opt.id);
                                  setActiveColorPickerId(null);
                                }}
                                title={opt.label}
                                className={`group relative flex h-7 w-7 cursor-pointer items-center justify-center rounded-full transition-all hover:scale-115 ${
                                  isSelected
                                    ? 'scale-110 shadow-md ring-2 ring-white ring-offset-2 ring-offset-slate-900'
                                    : 'opacity-90 hover:opacity-100'
                                }`}
                                style={{ backgroundColor: opt.hex }}
                              >
                                {isSelected && (
                                  <Check className="h-3.5 w-3.5 font-extrabold text-white drop-shadow-md" />
                                )}
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

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <h4 className="mb-1 flex items-center gap-1.5 text-xs font-bold text-slate-700">
          <ShieldAlert className="h-3.5 w-3.5 text-teal-700" /> Preservation Mode
        </h4>
        <p className="text-[11px] leading-relaxed text-slate-500">
          Original resolution, embedded fonts, and vector data are kept fully intact.
          No quality loss will occur during page assembly.
        </p>
      </div>
    </div>
  );
}
