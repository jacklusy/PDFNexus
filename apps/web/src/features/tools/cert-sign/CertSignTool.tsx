'use client';

import React, { useId, useRef, useState } from 'react';
import { AlertTriangle, ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/shared/ui/Button';
import { downloadBlobLocally } from '@/features/files/localDownload';
import { ToolWorkbench } from '../ToolWorkbench';
import { ToolError } from '../ToolError';
import { useToolHandoff } from '../useToolHandoff';
import { clearPassword } from '../protect/pdfToolkit';
import {
  CERT_SIGN_CMS_GAP,
  CERT_SIGN_EXPERIMENTAL_NOTICE,
  certSignPdf,
} from './certSignPdf';

export function CertSignTool() {
  const { files, setFiles } = useToolHandoff();
  const [p12File, setP12File] = useState<File | null>(null);
  const [password, setPassword] = useState('');
  const [confirmAppearance, setConfirmAppearance] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorFileName, setErrorFileName] = useState<string | undefined>();
  const [progress, setProgress] = useState<string | null>(null);
  const p12InputId = useId();
  const p12Ref = useRef<HTMLInputElement>(null);

  const file = files[0]?.file;
  const canRun =
    Boolean(file) &&
    Boolean(p12File) &&
    password.length > 0 &&
    confirmAppearance &&
    !busy;

  const run = async () => {
    if (!file || !p12File || !confirmAppearance) return;
    setBusy(true);
    setError(null);
    setErrorFileName(undefined);
    setProgress('Reading certificate…');
    let pwd = password;
    try {
      const [pdfBytes, p12Bytes] = await Promise.all([
        file.arrayBuffer(),
        p12File.arrayBuffer(),
      ]);
      setProgress('Applying experimental certificate appearance…');
      const result = await certSignPdf({
        pdfBytes,
        p12Bytes,
        password: pwd,
      });
      const name = file.name.replace(/\.pdf$/i, '') + '-cert-signed.pdf';
      downloadBlobLocally(
        new Blob([result.bytes], { type: 'application/pdf' }),
        name
      );
      setProgress(
        `Downloaded (CN: ${result.commonName}). ${CERT_SIGN_EXPERIMENTAL_NOTICE}`
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      const p12ish =
        /password|pkcs|p12|pfx|certificate|cert/i.test(msg) ||
        msg.toLowerCase().includes('wrong');
      setErrorFileName(p12ish ? p12File.name : file.name);
      setProgress(null);
    } finally {
      clearPassword(pwd);
      pwd = '';
      setPassword('');
      setBusy(false);
    }
  };

  return (
    <ToolWorkbench
      title="Certificate sign (experimental)"
      description="Import a PKCS#12 certificate and apply an experimental crypto-intent appearance. Distinct from visual Sign PDF."
      files={files}
      onFilesChange={(next) => {
        setFiles(next);
        setConfirmAppearance(false);
        setError(null);
        setProgress(null);
      }}
      busy={busy}
      processingMode="local"
      experimental
      privacyNote="Certificate password and PKCS#12 stay in your browser. Passwords are never logged or uploaded."
      footer={
        <Button
          variant="primary"
          disabled={!canRun}
          loading={busy}
          onClick={() => void run()}
        >
          Apply cert appearance & download
        </Button>
      }
    >
      <div
        className="flex gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4"
        role="alert"
      >
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden />
        <div className="space-y-2 text-sm">
          <p className="font-semibold text-[var(--color-ink)]">
            Not the same as Sign PDF
          </p>
          <p className="text-[var(--color-muted)]">
            <Link href="/sign-pdf" className="underline underline-offset-2">
              Sign PDF
            </Link>{' '}
            adds a visual electronic stamp only. This tool parses a real PKCS#12
            certificate and stamps CN + date, attaches <code>signer.pem</code> and a
            detached <code>.p7s</code> when the private key is present, and sets
            experimental metadata. It does <strong>not</strong> embed ISO 32000
            /ByteRange CMS — Adobe Reader will not show a validated signature.
          </p>
          <p className="text-[var(--color-muted)]">{CERT_SIGN_EXPERIMENTAL_NOTICE}</p>
          <p className="text-[var(--color-muted)]">{CERT_SIGN_CMS_GAP}</p>
          <p className="text-[var(--color-muted)]">
            Detached <code>.p7s</code> (when present) covers the <strong>original</strong>{' '}
            PDF bytes before the appearance stamp — it will not verify the downloaded
            stamped file.
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm sm:col-span-2">
          <span className="font-medium">PKCS#12 certificate (.p12 / .pfx)</span>
          <input
            ref={p12Ref}
            id={p12InputId}
            type="file"
            accept=".p12,.pfx,application/x-pkcs12,application/pkcs12"
            className="mt-1 block w-full text-sm"
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              setP12File(f);
              setError(null);
              e.target.value = '';
            }}
          />
          {p12File ? (
            <span className="mt-1 block text-xs text-[var(--color-muted)]">
              Selected: {p12File.name}
            </span>
          ) : null}
        </label>

        <label className="text-sm sm:col-span-2">
          <span className="font-medium">Certificate password</span>
          <input
            type="password"
            autoComplete="off"
            className="mt-1 w-full rounded-lg border border-[var(--color-border)] px-3 py-2"
            value={password}
            disabled={busy}
            onChange={(e) => setPassword(e.target.value)}
          />
          <span className="mt-1 block text-xs text-[var(--color-muted)]">
            Cleared from memory after use; never logged.
          </span>
        </label>
      </div>

      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          className="mt-1"
          checked={confirmAppearance}
          onChange={(e) => setConfirmAppearance(e.target.checked)}
          disabled={busy || !file || !p12File}
        />
        <span>
          I confirm I want an experimental certificate appearance (CN + date stamp +
          PEM and optional detached .p7s over original bytes), not an Adobe-validated
          digital signature.
        </span>
      </label>

      {!file || !p12File ? (
        <p className="flex items-start gap-2 text-xs text-[var(--color-muted)]">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          Provide both a PDF and a PKCS#12 file to continue.
        </p>
      ) : null}

      {progress ? <p className="text-sm text-[var(--color-muted)]">{progress}</p> : null}
      {error ? (
        <ToolError
          message={error}
          fileName={errorFileName}
          onRetry={() => {
            setError(null);
            setErrorFileName(undefined);
            void run();
          }}
        />
      ) : null}
    </ToolWorkbench>
  );
}
