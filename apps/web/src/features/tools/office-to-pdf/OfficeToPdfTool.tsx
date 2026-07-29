'use client';

import React, { useState } from 'react';
import { AlertTriangle, Server } from 'lucide-react';
import { Button } from '@/shared/ui/Button';
import { downloadBlobLocally } from '@/features/files/localDownload';
import { ApiError, apiFetch } from '@/lib/api';
import { ToolWorkbench, type ToolFile } from '../ToolWorkbench';
import {
  canUploadOfficeForConversion,
  OFFICE_MAX_BYTES,
  OFFICE_UPLOAD_CONSENT_LABEL,
} from './officeConsent';

const OFFICE_ACCEPT = [
  '.docx',
  '.xlsx',
  '.pptx',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
].join(',');

export function OfficeToPdfTool() {
  const [files, setFiles] = useState<ToolFile[]>([]);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);

  const file = files[0]?.file;

  const run = async () => {
    if (
      !canUploadOfficeForConversion({
        consent,
        hasFile: Boolean(file),
        fileSize: file?.size,
      }) ||
      !file
    ) {
      return;
    }
    if (file.size > OFFICE_MAX_BYTES) {
      setError('File exceeds the 25MB limit.');
      return;
    }
    setBusy(true);
    setError(null);
    setProgress('Uploading to conversion server…');
    try {
      const form = new FormData();
      form.append('file', file, file.name);
      const blob = await apiFetch<Blob>('/api/conversions/office-to-pdf', {
        method: 'POST',
        body: form,
      });
      const name = file.name.replace(/\.(docx|xlsx|pptx)$/i, '') + '.pdf';
      downloadBlobLocally(
        blob instanceof Blob ? blob : new Blob([blob], { type: 'application/pdf' }),
        name
      );
      setProgress('Downloaded PDF');
    } catch (e) {
      if (e instanceof ApiError) {
        setError(e.message);
      } else {
        setError(e instanceof Error ? e.message : String(e));
      }
      setProgress(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ToolWorkbench
      title="Office to PDF"
      description="Convert Word, Excel, or PowerPoint files to PDF via the conversion server (LibreOffice / Gotenberg)."
      accept={OFFICE_ACCEPT}
      files={files}
      onFilesChange={(next) => {
        setFiles(next);
        setConsent(false);
        setError(null);
        setProgress(null);
      }}
      busy={busy}
      badgeLabel="Server conversion"
      dropLabel="Drop a DOCX, XLSX, or PPTX here"
      dropHint="Requires explicit consent — file is uploaded only after you agree"
      pickerLabel="Choose Office file"
      privacyNote="This tool uploads your file to the conversion server only after you check the consent box. Local-first PDF tools never upload without asking."
      footer={
        <Button
          variant="primary"
          disabled={
            busy ||
            !canUploadOfficeForConversion({
              consent,
              hasFile: Boolean(file),
              fileSize: file?.size,
            })
          }
          loading={busy}
          onClick={() => void run()}
        >
          Convert & download PDF
        </Button>
      }
    >
      <div
        className="flex gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-accent-soft)]/40 p-4"
        role="note"
      >
        <Server
          className="mt-0.5 h-5 w-5 shrink-0 text-[var(--color-accent)]"
          aria-hidden
        />
        <div className="space-y-1 text-sm">
          <p className="font-semibold text-[var(--color-ink)]">
            Consent required before upload
          </p>
          <p className="text-[var(--color-muted)]">
            Browser engines cannot reliably preserve Office layout. Conversion runs on a
            LibreOffice server (Gotenberg). Your file is sent only when you consent below —
            never silently.
          </p>
        </div>
      </div>

      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          className="mt-1"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          disabled={busy || !file}
        />
        <span>{OFFICE_UPLOAD_CONSENT_LABEL}</span>
      </label>

      {file && file.size > OFFICE_MAX_BYTES ? (
        <p className="flex items-start gap-2 text-sm text-[var(--color-danger)]" role="alert">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          File exceeds the 25MB limit.
        </p>
      ) : null}

      {progress ? <p className="text-sm text-[var(--color-muted)]">{progress}</p> : null}
      {error ? (
        <p className="text-sm text-[var(--color-danger)]" role="alert">
          {error}
        </p>
      ) : null}
    </ToolWorkbench>
  );
}
