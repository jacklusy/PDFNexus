'use client';

import React, { useState } from 'react';
import { Button } from '@/shared/ui/Button';
import { downloadBlobLocally } from '@/features/files/localDownload';
import { ToolWorkbench, type ToolFile } from '../ToolWorkbench';
import { clearPassword, getPdfToolkit } from '../protect/pdfToolkit';
import { sanitizeToolkitError } from '../assertPdfReadable';

export function UnlockTool() {
  const [files, setFiles] = useState<ToolFile[]>([]);
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);

  const file = files[0]?.file;

  const run = async () => {
    if (!file) return;
    if (!password) {
      setError('Enter the PDF password.');
      return;
    }
    setBusy(true);
    setError(null);
    setProgress('Loading decryption engine…');
    let pwd = password;
    try {
      const toolkit = await getPdfToolkit();
      setProgress('Unlocking…');
      const bytes = await file.arrayBuffer();
      const unlocked = await toolkit.unlock(new Uint8Array(bytes), {
        password: pwd,
      });
      const name = file.name.replace(/\.pdf$/i, '') + '-unlocked.pdf';
      downloadBlobLocally(
        new Blob([unlocked], { type: 'application/pdf' }),
        name
      );
      setProgress('Downloaded unlocked PDF');
      clearPassword(pwd);
      pwd = '';
      setPassword('');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const name = e instanceof Error ? e.name : '';
      if (
        name === 'PdfPasswordError' ||
        /password/i.test(msg) ||
        /invalid/i.test(msg)
      ) {
        setError('Invalid password. Enter the correct password for this PDF.');
      } else {
        setError(sanitizeToolkitError(e));
      }
      setProgress(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ToolWorkbench
      title="Unlock PDF"
      description="Remove password protection when you know the password. No cracking or bypass attempts."
      files={files}
      onFilesChange={setFiles}
      busy={busy}
      footer={
        <Button
          variant="primary"
          disabled={!file || busy}
          loading={busy}
          onClick={() => void run()}
        >
          Unlock & download
        </Button>
      }
    >
      <label className="block text-sm">
        <span className="font-medium">Current password</span>
        <input
          type={show ? 'text' : 'password'}
          autoComplete="current-password"
          className="mt-1 w-full rounded-lg border border-[var(--color-border)] px-3 py-2"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={busy}
        />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={show}
          onChange={(e) => setShow(e.target.checked)}
          disabled={busy}
        />
        Show password
      </label>
      <p className="text-xs text-[var(--color-muted)]">
        This tool only decrypts with a password you provide. It will not attempt to guess or
        bypass protection.
      </p>
      {progress ? <p className="text-sm text-[var(--color-muted)]">{progress}</p> : null}
      {error ? (
        <p className="text-sm text-[var(--color-danger)]" role="alert">
          {error}
        </p>
      ) : null}
    </ToolWorkbench>
  );
}
