'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Cloud, Link2Off, Loader2, Upload } from 'lucide-react';
import { Button } from '@/shared/ui/Button';
import { ApiError, apiFetch, apiPostJson } from '@/lib/api';
import { ToolError } from '@/features/tools/ToolError';
import { canUseDriveExport, CONSENT_LABEL } from './driveConsent';
import { openGooglePdfPicker } from './googlePicker';

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
  const [appFiles, setAppFiles] = useState<DriveFileRow[]>([]);
  const [consent, setConsent] = useState(false);
  const [exportResult, setExportResult] = useState<string | null>(null);
  const [pickerHint, setPickerHint] = useState<string | null>(null);
  const [lastAction, setLastAction] = useState<
    | { kind: 'connect' }
    | { kind: 'list' }
    | { kind: 'import'; fileId: string; name: string }
    | { kind: 'picker' }
    | { kind: 'export' }
    | null
  >(null);

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
        setLastAction({ kind: 'connect' });
        setConnected(false);
        return false;
      }
      setConnected(false);
      return false;
    }
  }, []);

  const loadAppFiles = useCallback(async () => {
    try {
      const data = await apiFetch<{ files: DriveFileRow[] }>(
        '/api/cloud/drive/files'
      );
      setAppFiles(data.files ?? []);
    } catch (e) {
      setAppFiles([]);
      setError(e instanceof ApiError ? e.message : String(e));
      setLastAction({ kind: 'list' });
    }
  }, []);

  useEffect(() => {
    void (async () => {
      const ok = await refreshStatus();
      if (ok) await loadAppFiles();
    })();
  }, [refreshStatus, loadAppFiles]);

  const connect = async () => {
    setBusy(true);
    setError(null);
    setLastAction({ kind: 'connect' });
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
      setAppFiles([]);
      setConsent(false);
      setExportResult(null);
      setPickerHint(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
      setLastAction({ kind: 'connect' });
    } finally {
      setBusy(false);
    }
  };

  const importFile = async (fileId: string, name: string) => {
    if (!onImport) return;
    setBusy(true);
    setError(null);
    setLastAction({ kind: 'import', fileId, name });
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
      await loadAppFiles();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const pickFromDrive = async () => {
    if (!onImport) return;
    setBusy(true);
    setError(null);
    setPickerHint(null);
    setLastAction({ kind: 'picker' });
    try {
      const config = await apiFetch<{
        clientId: string;
        accessToken: string;
        developerKey?: string;
      }>('/api/cloud/drive/picker-config');

      const picked = await openGooglePdfPicker({
        clientId: config.clientId,
        accessToken: config.accessToken,
        developerKey: config.developerKey,
      });

      if (!picked) {
        setPickerHint('No file selected.');
        return;
      }

      await importFile(picked.id, picked.name);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : String(e);
      if (/picker|script|blocked|csp/i.test(msg)) {
        setPickerHint(
          'Google Picker could not load. You can still import PDFs this app created or previously opened (listed below).'
        );
      }
      setError(msg);
    } finally {
      setBusy(false);
    }
  };

  const exportToDrive = async () => {
    if (!exportFile || !canUseDriveExport(consent)) return;
    setBusy(true);
    setError(null);
    setExportResult(null);
    setLastAction({ kind: 'export' });
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
      await loadAppFiles();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const retryLast = () => {
    setError(null);
    if (!lastAction) return;
    if (lastAction.kind === 'connect') void connect();
    else if (lastAction.kind === 'list') void loadAppFiles();
    else if (lastAction.kind === 'import') void importFile(lastAction.fileId, lastAction.name);
    else if (lastAction.kind === 'picker') void pickFromDrive();
    else if (lastAction.kind === 'export') void exportToDrive();
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
              Optional import/export with drive.file scope. Use Google Picker to
              choose PDFs; this app cannot browse your full Drive library.
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
          {onImport ? (
            <div className="space-y-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={busy}
                onClick={() => void pickFromDrive()}
              >
                Pick PDF from Drive
              </Button>
              {pickerHint ? (
                <p className="text-sm text-[var(--color-muted)]">{pickerHint}</p>
              ) : null}
              <p className="text-xs text-[var(--color-muted)]">
                Files you pick or that this app created appear below.
              </p>
              <ul className="max-h-40 space-y-1 overflow-y-auto text-sm">
                {appFiles.length === 0 && !busy ? (
                  <li className="text-[var(--color-muted)]">
                    No app-accessible PDFs yet. Use Pick PDF from Drive.
                  </li>
                ) : null}
                {appFiles.map((f) => (
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
            </div>
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
        <ToolError
          message={error}
          originalSafe
          cloudNote="Drive import/export is optional. Your local originals stay on this device."
          onRetry={lastAction ? () => retryLast() : undefined}
        />
      ) : null}
    </div>
  );
}
