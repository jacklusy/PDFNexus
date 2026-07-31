'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Cloud, Link2Off, Loader2, Upload } from 'lucide-react';
import { Button } from '@/shared/ui/Button';
import { ApiError, apiFetch, apiPostJson } from '@/lib/api';
import { ToolError } from '@/features/tools/ToolError';
import {
  canUseCloudExport,
  consentLabelFor,
  type CloudProviderName,
} from './driveConsent';

export interface GenericCloudPanelProps {
  provider: 'dropbox' | 'onedrive';
  title: CloudProviderName;
  description: string;
  onImport?: (file: File) => void;
  exportFile?: File | null;
  className?: string;
}

export function GenericCloudPanel({
  provider,
  title,
  description,
  onImport,
  exportFile = null,
  className,
}: GenericCloudPanelProps) {
  const base = `/api/cloud/${provider}`;
  const [connected, setConnected] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [files, setFiles] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [consent, setConsent] = useState(false);
  const [exportResult, setExportResult] = useState<string | null>(null);
  const [lastAction, setLastAction] = useState<
    | { kind: 'connect' }
    | { kind: 'disconnect' }
    | { kind: 'list' }
    | { kind: 'import'; fileId: string; name: string }
    | { kind: 'export' }
    | null
  >(null);

  const refreshStatus = useCallback(async () => {
    try {
      const status = await apiFetch<{ connected: boolean }>(`${base}/status`);
      setConnected(Boolean(status.connected));
      return Boolean(status.connected);
    } catch (e) {
      if (e instanceof ApiError && e.status === 503) {
        setError(e.message);
        setLastAction({ kind: 'connect' });
      }
      setConnected(false);
      return false;
    }
  }, [base]);

  const loadFiles = useCallback(async () => {
    try {
      const data = await apiFetch<{ files: Array<{ id: string; name: string }> }>(
        `${base}/files`
      );
      setFiles(data.files ?? []);
    } catch (e) {
      setFiles([]);
      setError(e instanceof ApiError ? e.message : String(e));
      setLastAction({ kind: 'list' });
    }
  }, [base]);

  useEffect(() => {
    void (async () => {
      const ok = await refreshStatus();
      if (ok) await loadFiles();
    })();
  }, [refreshStatus, loadFiles]);

  const connect = async () => {
    setBusy(true);
    setError(null);
    setLastAction({ kind: 'connect' });
    try {
      const { url } = await apiFetch<{ url: string }>(`${base}/auth-url`);
      window.location.href = url;
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
      setBusy(false);
    }
  };

  const disconnect = async () => {
    setBusy(true);
    try {
      await apiPostJson(`${base}/disconnect`, {});
      setConnected(false);
      setFiles([]);
      setConsent(false);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
      setLastAction({ kind: 'disconnect' });
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
      const blob = await apiFetch<Blob>(`${base}/import`, {
        method: 'POST',
        body: JSON.stringify({ fileId }),
      });
      onImport(
        new File(
          [blob instanceof Blob ? blob : new Blob([blob])],
          name.endsWith('.pdf') ? name : `${name}.pdf`,
          { type: 'application/pdf' }
        )
      );
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const exportToCloud = async () => {
    if (!exportFile || !canUseCloudExport(consent)) return;
    setBusy(true);
    setError(null);
    setLastAction({ kind: 'export' });
    try {
      const form = new FormData();
      form.append('file', exportFile, exportFile.name);
      const result = await apiFetch<{ name: string }>(`${base}/export`, {
        method: 'POST',
        body: form,
      });
      setExportResult(`Uploaded “${result.name}”`);
      await loadFiles();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const retryLast = () => {
    if (!lastAction) return;
    if (lastAction.kind === 'export') {
      if (!canUseCloudExport(consent)) {
        setError('Check the consent box, then use Retry to export again.');
        return;
      }
      setError(null);
      void exportToCloud();
      return;
    }
    setError(null);
    if (lastAction.kind === 'connect') void connect();
    else if (lastAction.kind === 'disconnect') void disconnect();
    else if (lastAction.kind === 'list') void loadFiles();
    else if (lastAction.kind === 'import') void importFile(lastAction.fileId, lastAction.name);
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
            <p className="font-semibold text-[var(--color-ink)]">{title}</p>
            <p className="text-sm text-[var(--color-muted)]">{description}</p>
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
            <ul className="max-h-40 space-y-1 overflow-y-auto text-sm">
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
                <span>{consentLabelFor(title)}</span>
              </label>
              <Button
                variant="secondary"
                size="sm"
                disabled={busy || !canUseCloudExport(consent)}
                onClick={() => void exportToCloud()}
              >
                <Upload className="h-4 w-4" aria-hidden />
                Export to {title}
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
          cloudNote="Cloud import/export is optional. Your local originals stay on this device."
          onRetry={lastAction ? () => retryLast() : undefined}
        />
      ) : null}
    </div>
  );
}
