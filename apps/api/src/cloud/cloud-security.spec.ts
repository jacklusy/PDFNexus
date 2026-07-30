import { describe, expect, it } from 'vitest';
import {
  decryptToken,
  encryptToken,
  isEncryptedPayload,
} from './token-crypto';
import { oauthCallbackSessionMatches } from './oauth-callback-guard';
import { isPdfUpload, isCloudPdfMeta, isCloudTokenConnected, isPdfMagic, isUnderOneDriveApproot, dropboxAppFolderUploadPath, readCloudBodyCapped, MAX_CLOUD_FILE_BYTES } from './cloud-constants';
import {
  deserializeCloudTokenRecord,
  serializeCloudTokenRecord,
} from './oauth-token-store';
import { Logger } from '@nestjs/common';

describe('token-crypto', () => {
  const secret = 'a'.repeat(32);

  it('round-trips encrypt/decrypt', () => {
    const enc = encryptToken('refresh-secret', secret);
    expect(isEncryptedPayload(enc)).toBe(true);
    expect(decryptToken(enc, secret)).toBe('refresh-secret');
  });

  it('rejects tampered ciphertext', () => {
    const enc = encryptToken('refresh-secret', secret);
    const bad = enc.slice(0, -4) + 'xxxx';
    expect(() => decryptToken(bad, secret)).toThrow();
  });
});

describe('oauthCallbackSessionMatches', () => {
  it('rejects missing or mismatched cookies', () => {
    expect(oauthCallbackSessionMatches(null, 'abc123456789012345')).toBe(false);
    expect(oauthCallbackSessionMatches('other', 'abc123456789012345')).toBe(false);
    expect(
      oauthCallbackSessionMatches('abc123456789012345', 'abc123456789012345'),
    ).toBe(true);
  });

  it('rejects unequal length and short cookies', () => {
    expect(oauthCallbackSessionMatches('short', 'abc123456789012345')).toBe(false);
    expect(
      oauthCallbackSessionMatches('abc12345678901234x', 'abc123456789012345'),
    ).toBe(false);
  });
});

describe('cloud PDF + size gates', () => {
  it('caps at 50MB', () => {
    expect(MAX_CLOUD_FILE_BYTES).toBe(50 * 1024 * 1024);
  });

  it('accepts PDF mime or .pdf name; rejects bare octet-stream', () => {
    expect(isPdfUpload({ mimetype: 'application/pdf', originalname: 'a.bin' })).toBe(
      true,
    );
    expect(isPdfUpload({ mimetype: 'text/plain', originalname: 'a.pdf' })).toBe(true);
    expect(
      isPdfUpload({ mimetype: 'application/octet-stream', originalname: 'a.pdf' }),
    ).toBe(true);
    expect(
      isPdfUpload({ mimetype: 'application/octet-stream', originalname: 'a.bin' }),
    ).toBe(false);
    expect(isPdfUpload({ mimetype: 'image/png', originalname: 'a.png' })).toBe(false);
  });

  it('rejects non-PDF import metadata', () => {
    expect(isCloudPdfMeta({ name: 'doc.pdf' })).toBe(true);
    expect(isCloudPdfMeta({ mimeType: 'application/pdf' })).toBe(true);
    expect(isCloudPdfMeta({ name: 'notes.docx', mimeType: 'application/msword' })).toBe(
      false,
    );
  });

  it('isConnected requires refresh or non-expired access', () => {
    expect(isCloudTokenConnected(null)).toBe(false);
    expect(isCloudTokenConnected({ refreshToken: 'r' })).toBe(true);
    expect(
      isCloudTokenConnected({
        accessToken: 'a',
        accessExpiresAt: Date.now() + 60_000,
      }),
    ).toBe(true);
    expect(
      isCloudTokenConnected({
        accessToken: 'a',
        accessExpiresAt: Date.now() - 1,
      }),
    ).toBe(false);
    expect(isCloudTokenConnected({ accessToken: 'a' })).toBe(false);
  });

  it('requires %PDF- magic bytes within first 1024', () => {
    expect(isPdfMagic(Buffer.from('%PDF-1.7\n'))).toBe(true);
    expect(isPdfMagic(Buffer.from('xxxx%PDF-1.4'))).toBe(true);
    expect(isPdfMagic(Buffer.from('not a pdf'))).toBe(false);
    expect(isPdfMagic(Buffer.from('%PD'))).toBe(false);
  });

  it('approot path uses rooted /drive/root:/Apps/{name}', () => {
    expect(
      isUnderOneDriveApproot({
        approotId: 'root',
        parentId: 'root',
      }),
    ).toBe(true);
    expect(
      isUnderOneDriveApproot({
        approotName: 'MyApp',
        parentPath: '/drive/root:/Apps/MyApp/docs',
      }),
    ).toBe(true);
    expect(
      isUnderOneDriveApproot({
        approotName: 'MyApp',
        parentPath: '/drive/root:/Apps/MyAppExtra/x',
      }),
    ).toBe(false);
    expect(
      isUnderOneDriveApproot({
        approotName: 'MyApp',
        parentPath: '/drive/root:/Other/Apps/MyApp/x',
      }),
    ).toBe(false);
  });

  it('dropbox upload path is basename-only', () => {
    expect(dropboxAppFolderUploadPath('../evil.pdf')).toBe('/evil.pdf');
    expect(dropboxAppFolderUploadPath('a/b/c.pdf')).toBe('/c.pdf');
    expect(dropboxAppFolderUploadPath('notes')).toBe('/notes.pdf');
  });

  it('readCloudBodyCapped rejects oversized Content-Length', async () => {
    const res = new Response(null, {
      status: 200,
      headers: { 'content-length': String(MAX_CLOUD_FILE_BYTES + 1) },
    });
    await expect(readCloudBodyCapped(res, MAX_CLOUD_FILE_BYTES)).rejects.toMatchObject({
      code: 'TOO_LARGE',
    });
  });

  it('readCloudBodyCapped accepts small body', async () => {
    const body = Buffer.from('%PDF-1.4 tiny');
    const res = new Response(body, { status: 200 });
    const buf = await readCloudBodyCapped(res, MAX_CLOUD_FILE_BYTES);
    expect(buf.equals(body)).toBe(true);
  });

  it('readCloudBodyCapped rejects empty body', async () => {
    const res = new Response(new Uint8Array(0), { status: 200 });
    await expect(readCloudBodyCapped(res, MAX_CLOUD_FILE_BYTES)).rejects.toMatchObject({
      code: 'EMPTY',
    });
  });

  it('readCloudBodyCapped rejects streaming body over max without Content-Length', async () => {
    const max = 64;
    const chunk = new Uint8Array(40);
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(chunk);
        controller.enqueue(chunk);
        controller.close();
      },
    });
    const res = new Response(stream, { status: 200 });
    await expect(readCloudBodyCapped(res, max)).rejects.toMatchObject({
      code: 'TOO_LARGE',
    });
  });
});

describe('serializeCloudTokenRecord fail-closed', () => {
  const secret = 'b'.repeat(40);
  const logger = new Logger('test');

  it('encrypts when key configured', () => {
    const raw = serializeCloudTokenRecord(
      { refreshToken: 'r1', connectedAt: 1 },
      secret,
      logger,
      { current: true },
      'test',
    );
    const parsed = JSON.parse(raw) as { refreshToken: string };
    expect(isEncryptedPayload(parsed.refreshToken)).toBe(true);
    const back = deserializeCloudTokenRecord(raw, secret);
    expect(back.refreshToken).toBe('r1');
  });

  it('rejects plaintext while key is set', () => {
    expect(() =>
      deserializeCloudTokenRecord(
        JSON.stringify({ refreshToken: 'plaintext', connectedAt: 1 }),
        secret,
      ),
    ).toThrow(/plaintext/i);
  });
});
