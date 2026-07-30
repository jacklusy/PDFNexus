'use client';

import React, { useState } from 'react';
import { Button } from '@/shared/ui/Button';
import { downloadBlobLocally } from '@/features/files/localDownload';
import { ToolWorkbench, type ToolFile } from '../ToolWorkbench';
import { clearPassword, getPdfToolkit, passwordStrength } from './pdfToolkit';
import { sanitizeToolkitError } from '../assertPdfReadable';
import { ToolError } from '../ToolError';

export function ProtectTool() {
  const [files, setFiles] = useState<ToolFile[]>([]);
  const [userPassword, setUserPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [ownerPassword, setOwnerPassword] = useState('');
  const [show, setShow] = useState(false);
  const [allowPrint, setAllowPrint] = useState(true);
  const [allowModify, setAllowModify] = useState(false);
  const [allowExtract, setAllowExtract] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);

  const strength = passwordStrength(userPassword);
  const file = files[0]?.file;

  const run = async () => {
    if (!file) return;
    if (!userPassword) {
      setError('Enter a user password to open the PDF.');
      return;
    }
    if (userPassword !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setBusy(true);
    setError(null);
    setProgress('Loading encryption engine…');
    let user = userPassword;
    let owner = ownerPassword || userPassword;
    try {
      const toolkit = await getPdfToolkit();
      setProgress('Encrypting…');
      const bytes = await file.arrayBuffer();
      const locked = await toolkit.lock(new Uint8Array(bytes), {
        userPassword: user,
        ownerPassword: owner,
        keyLength: 256,
        permissions: {
          print: allowPrint ? 'full' : 'none',
          modify: allowModify ? 'all' : 'none',
          extract: allowExtract,
        },
      });
      const name = file.name.replace(/\.pdf$/i, '') + '-protected.pdf';
      downloadBlobLocally(
        new Blob([locked], { type: 'application/pdf' }),
        name
      );
      setProgress('Downloaded protected PDF');
    } catch (e) {
      setError(sanitizeToolkitError(e));
      setProgress(null);
    } finally {
      clearPassword(user);
      clearPassword(owner);
      user = '';
      owner = '';
      setUserPassword('');
      setConfirm('');
      setOwnerPassword('');
      setBusy(false);
    }
  };

  return (
    <ToolWorkbench
      title="Protect PDF"
      description="Encrypt with AES-256 in your browser. Passwords are never uploaded or logged."
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
          Protect & download
        </Button>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm sm:col-span-2">
          <span className="font-medium">User password (required to open)</span>
          <input
            type={show ? 'text' : 'password'}
            autoComplete="new-password"
            className="mt-1 w-full rounded-lg border border-[var(--color-border)] px-3 py-2"
            value={userPassword}
            onChange={(e) => setUserPassword(e.target.value)}
            disabled={busy}
          />
          <span className="mt-1 block text-xs text-[var(--color-muted)]">
            Strength: {strength.label}
          </span>
        </label>
        <label className="text-sm">
          <span className="font-medium">Confirm password</span>
          <input
            type={show ? 'text' : 'password'}
            autoComplete="new-password"
            className="mt-1 w-full rounded-lg border border-[var(--color-border)] px-3 py-2"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            disabled={busy}
          />
        </label>
        <label className="text-sm">
          <span className="font-medium">Owner password (optional)</span>
          <input
            type={show ? 'text' : 'password'}
            autoComplete="new-password"
            className="mt-1 w-full rounded-lg border border-[var(--color-border)] px-3 py-2"
            value={ownerPassword}
            onChange={(e) => setOwnerPassword(e.target.value)}
            disabled={busy}
            placeholder="Defaults to user password"
          />
        </label>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={show}
          onChange={(e) => setShow(e.target.checked)}
          disabled={busy}
        />
        Show passwords
      </label>

      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold">Permissions (owner restrictions)</legend>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={allowPrint}
            onChange={(e) => setAllowPrint(e.target.checked)}
            disabled={busy}
          />
          Allow printing
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={allowModify}
            onChange={(e) => setAllowModify(e.target.checked)}
            disabled={busy}
          />
          Allow modifying
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={allowExtract}
            onChange={(e) => setAllowExtract(e.target.checked)}
            disabled={busy}
          />
          Allow copying / extraction
        </label>
        <p className="text-xs text-[var(--color-muted)]">
          Owner permissions are not absolute — some PDF readers may ignore them. The user
          password is what reliably prevents opening the file.
        </p>
      </fieldset>

      {progress ? <p className="text-sm text-[var(--color-muted)]">{progress}</p> : null}
      {error ? (
        <ToolError
          message={error}
          fileName={file?.name}
          onRetry={() => { setError(null); void run(); }}
        />
      ) : null}
    </ToolWorkbench>
  );
}
