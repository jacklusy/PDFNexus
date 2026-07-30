import { describe, expect, it } from 'vitest';
import {
  decryptToken,
  encryptToken,
  isEncryptedPayload,
} from './token-crypto';
import { oauthCallbackSessionMatches } from './oauth-callback-guard';
import { isPdfUpload, MAX_CLOUD_FILE_BYTES } from './cloud-constants';
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
});

describe('cloud PDF + size gates', () => {
  it('caps at 50MB', () => {
    expect(MAX_CLOUD_FILE_BYTES).toBe(50 * 1024 * 1024);
  });

  it('accepts PDF mime/name only', () => {
    expect(isPdfUpload({ mimetype: 'application/pdf', originalname: 'a.bin' })).toBe(
      true,
    );
    expect(isPdfUpload({ mimetype: 'text/plain', originalname: 'a.pdf' })).toBe(true);
    expect(isPdfUpload({ mimetype: 'image/png', originalname: 'a.png' })).toBe(false);
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
