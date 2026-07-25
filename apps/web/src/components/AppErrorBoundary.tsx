'use client';

/**
 * Root error boundary — prevents a single throw from wiping the workspace UI.
 * Offers recovery guidance using the lightweight localStorage manifest.
 */

import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import {
  loadWorkspaceManifest,
  downloadManifestJson,
  clearWorkspaceManifest,
  type WorkspaceManifest,
} from '@/lib/pdf/workspaceRecovery';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
  manifest: WorkspaceManifest | null;
}

export class AppErrorBoundary extends Component<Props, State> {
  state: State = {
    hasError: false,
    message: '',
    manifest: null,
  };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      message: error?.message || 'An unexpected error occurred',
      manifest: loadWorkspaceManifest(),
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Privacy-safe: do not log file names or document content
    console.error('[AppErrorBoundary]', error.message, info.componentStack?.slice(0, 500));
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleDownloadManifest = () => {
    if (this.state.manifest) {
      downloadManifestJson(this.state.manifest);
    }
  };

  private handleDismissManifest = () => {
    clearWorkspaceManifest();
    this.setState({ manifest: null });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const { manifest, message } = this.state;

    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 font-sans">
        <div
          role="alert"
          className="max-w-lg w-full bg-white border border-slate-200 rounded-2xl shadow-lg p-6"
        >
          <h1 className="text-lg font-extrabold text-slate-900 tracking-tight">
            Something went wrong
          </h1>
          <p className="text-sm text-slate-600 mt-2 leading-relaxed">
            PDFNexus hit an unexpected error. Your page arrangement may still be
            recoverable from a local metadata snapshot (file binaries are never stored).
          </p>
          <p className="text-xs text-slate-400 mt-3 font-mono break-all bg-slate-50 border border-slate-100 rounded-lg p-2">
            {message}
          </p>

          {manifest && manifest.pages.length > 0 && (
            <div className="mt-4 p-3 bg-amber-50 border border-amber-100 rounded-xl text-left">
              <p className="text-xs font-bold text-amber-900">
                Recovery snapshot found
              </p>
              <p className="text-[11px] text-amber-800 mt-1">
                {manifest.pages.length} pages · {manifest.files.length} source files · saved{' '}
                {new Date(manifest.savedAt).toLocaleString()}
              </p>
              <p className="text-[11px] text-amber-700 mt-2 leading-relaxed">
                Download the snapshot, reload the app, re-upload the same source files,
                then restore order manually using the snapshot as a checklist.
              </p>
              <ul className="mt-2 max-h-28 overflow-y-auto text-[11px] text-amber-900 space-y-0.5">
                {manifest.files.map((f) => (
                  <li key={f.id} className="truncate">
                    • {f.name} ({f.pageCount}p)
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={this.handleReload}
              className="px-4 py-2.5 bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold rounded-xl"
            >
              Reload app
            </button>
            {manifest && (
              <>
                <button
                  type="button"
                  onClick={this.handleDownloadManifest}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-xl"
                >
                  Download snapshot
                </button>
                <button
                  type="button"
                  onClick={this.handleDismissManifest}
                  className="px-4 py-2.5 text-slate-500 hover:text-red-600 text-xs font-semibold rounded-xl"
                >
                  Discard snapshot
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }
}

export default AppErrorBoundary;
