'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Cloud, Link2Off, Loader2, Upload } from 'lucide-react';
import { Button } from '@/shared/ui/Button';
import { ApiError, apiFetch, apiPostJson } from '@/lib/api';
import { canUseDriveExport, CONSENT_LABEL } from './driveConsent';

export interface DriveFileRow {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  size?: string;
  webViewLink?: string;
}

export interface GoogleDrivePanelProps {
  /** Called when a Drive PDF has been imported as a local File. */
  onImport?: (file: File) => void;
  /** Optional local file to offer for export. */
  exportFile?: File | null;
  className?: string;
}

export function GoogleDrivePanel({
  onImport,
  exportFile = null,
  className,
}: GoogleDrivePanelProps) {
  const [connected, setConnected] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [files, setFiles] = useState<DriveFileRow[]>([]);
  const [query, setQuery] = useState('');
  const [consent, setConsent] = useState(false);
  const [exportResult, setExportResult] = useState<string | null>(null);

  const refreshStatus = useCallback(async () => {
    try {
      const status = await apiFetch<{ connected: boolean }>(
        '/api/cloud/drive/status'
      );
      setConnected(Boolean(status.connected));
      return Boolean(status.connected);
    } catch (e) {
      if (e instanceof ApiError && e.status === 503) {
        setError(e.message);
        setConnected(false);
        return false;
      }
      setConnected(false);
      return false;
    }
  }, []);

  const loadFiles = useCallback(
    async (q?: string) => {
      setBusy(true);
      setError(null);
      try {
        const qs = q?.trim() ? `?q=${encodeURIComponent(q.trim())}` : '';
        const data = await apiFetch<{ files: DriveFileRow[] }>(
          `/api/cloud/drive/files${qs}`
        );
        setFiles(data.files ?? []);
      } catch (e) {
        setError(e instanceof ApiError ? e.message : String(e));
        setFiles([]);
      } finally {
        setBusy(false);
      }
    },
    []
  );

  useEffect(() => {
    void (async () => {
      const ok = await refreshStatus();
      if (ok) await loadFiles();
    })();
  }, [refreshStatus, loadFiles]);

  const connect = async () => {
    setBusy(true);
    setError(null);
    try {
      const { url } = await apiFetch<{ url: string }>(
        '/api/cloud/drive/auth-url'
      );
      window.location.href = url;
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
      setBusy(false);
    }
  };

  const disconnect = async () => {
    setBusy(true);
    setError(null);
    try {
      await apiPostJson('/api/cloud/drive/disconnect', {});
      setConnected(false);
      setFiles([]);
      setConsent(false);
      setExportResult(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const importFile = async (fileId: string, name: string) => {
    if (!onImport) return;
    setBusy(true);
    setError(null);
    try {
      const blob = await apiFetch<Blob>('/api/cloud/drive/import', {
        method: 'POST',
        body: JSON.stringify({ fileId }),
      });
      const file = new File(
        [blob instanceof Blob ? blob : new Blob([blob])],
        name.endsWith('.pdf') ? name : `${name}.pdf`,
        { type: 'application/pdf' }
      );
      onImport(file);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const exportToDrive = async () => {
    if (!exportFile || !canUseDriveExport(consent)) return;
    setBusy(true);
    setError(null);
    setExportResult(null);
    try {
      const form = new FormData();
      form.append('file', exportFile, exportFile.name);
      const result = await apiFetch<{
        id: string;
        name: string;
        webViewLink: string;
      }>('/api/cloud/drive/export', {
        method: 'POST',
        body: form,
      });
      setExportResult(
        result.webViewLink
          ? `Uploaded “${result.name}”`
          : `Uploaded “${result.name}” (${result.id})`
      );
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className={
        className ??
        'space-y-3 rounded-xl border border-[var(--color-border)] p-4'
      }
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <Cloud
            className="mt-0.5 h-5 w-5 shrink-0 text-[var(--color-accent)]"
            aria-hidden
          />
          <div>
            <p className="font-semibold text-[var(--color-ink)]">Google Drive</p>
            <p className="text-sm text-[var(--color-muted)]">
              Optional import/export with drive.file scope only. Files leave the
              browser only when you act.
            </p>
          </div>
        </div>
        {connected ? (
          <Button
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={() => void disconnect()}
          >
            <Link2Off className="h-4 w-4" aria-hidden />
            Disconnect
          </Button>
        ) : (
          <Button
            variant="secondary"
            size="sm"
            disabled={busy}
            onClick={() => void connect()}
          >
            Connect
          </Button>
        )}
      </div>

      {connected ? (
        <>
          <div className="flex gap-2">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search PDFs…"
              className="h-9 flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm"
              disabled={busy}
            />
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => void loadFiles(query)}
            >
              Search
            </Button>
          </div>

          {onImport ? (
            <ul className="max-h-48 space-y-1 overflow-y-auto text-sm">
              {files.length === 0 && !busy ? (
                <li className="text-[var(--color-muted)]">No PDF files found.</li>
              ) : null}
              {files.map((f) => (
                <li
                  key={f.id}
                  className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 hover:bg-[var(--color-surface-2)]"
                >
                  <span className="truncate">{f.name}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    onClick={() => void importFile(f.id, f.name)}
                  >
                    Import
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}

          {exportFile ? (
            <div className="space-y-2 border-t border-[var(--color-border)] pt-3">
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  disabled={busy}
                />
                <span>{CONSENT_LABEL}</span>
              </label>
              <Button
                variant="secondary"
                size="sm"
                disabled={busy || !canUseDriveExport(consent)}
                loading={busy}
                onClick={() => void exportToDrive()}
              >
                <Upload className="h-4 w-4" aria-hidden />
                Export “{exportFile.name}” to Drive
              </Button>
              {exportResult ? (
                <p className="text-sm text-[var(--color-muted)]">{exportResult}</p>
              ) : null}
            </div>
          ) : null}
        </>
      ) : null}

      {busy ? (
        <p className="flex items-center gap-2 text-sm text-[var(--color-muted)]">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Working…
        </p>
      ) : null}
      {error ? (
        <p className="text-sm text-[var(--color-danger)]" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
