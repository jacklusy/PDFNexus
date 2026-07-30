import { Logger } from '@nestjs/common';
import type { CloudTokenRecord } from './cloud-provider';
import {
  decryptToken,
  encryptToken,
  isEncryptedPayload,
} from './token-crypto';
import { isCloudTokenEncryptionConfigured } from './encryption-key';

export function serializeCloudTokenRecord(
  record: CloudTokenRecord,
  encryptionKey: string,
  logger: Logger,
  warnedMissingKey: { current: boolean },
  providerLabel: string,
): string {
  let refreshToken = record.refreshToken;
  let accessToken = record.accessToken;

  if (isCloudTokenEncryptionConfigured(encryptionKey)) {
    if (refreshToken) refreshToken = encryptToken(refreshToken, encryptionKey);
    if (accessToken) accessToken = encryptToken(accessToken, encryptionKey);
  } else if (!warnedMissingKey.current) {
    warnedMissingKey.current = true;
    logger.warn(
      `Cloud token encryption key missing or shorter than 32 chars — storing ${providerLabel} tokens unencrypted (dev only)`,
    );
  }

  return JSON.stringify({
    ...record,
    refreshToken,
    accessToken,
  });
}

/**
 * When an encryption key is configured, reject plaintext / undecryptable tokens
 * (fail closed — do not accept Redis-injected plaintext).
 */
export function deserializeCloudTokenRecord(
  raw: string,
  encryptionKey: string,
): CloudTokenRecord {
  const parsed = JSON.parse(raw) as CloudTokenRecord;
  let refreshToken = parsed.refreshToken ?? '';
  let accessToken = parsed.accessToken;

  if (isCloudTokenEncryptionConfigured(encryptionKey)) {
    if (refreshToken) {
      if (!isEncryptedPayload(refreshToken)) {
        throw new Error('Rejecting plaintext refresh token while encryption key is set');
      }
      refreshToken = decryptToken(refreshToken, encryptionKey);
    }
    if (accessToken) {
      if (!isEncryptedPayload(accessToken)) {
        throw new Error('Rejecting plaintext access token while encryption key is set');
      }
      accessToken = decryptToken(accessToken, encryptionKey);
    }
  }

  return { ...parsed, refreshToken, accessToken };
}
