import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../redis/redis.service';
import { decryptToken, encryptToken } from './token-crypto';

const TOKEN_TTL_SEC = 60 * 24 * 60 * 60;
const STATE_TTL_SEC = 10 * 60;

export interface CloudTokenRecord {
  refreshToken: string;
  accessToken?: string;
  accessExpiresAt?: number;
  connectedAt: number;
}

/**
 * Encrypted Redis token store shared by Drive / Dropbox / OneDrive.
 * Production requires GOOGLE_TOKEN_ENCRYPTION_KEY (or CLOUD_TOKEN_ENCRYPTION_KEY) ≥32 chars.
 */
@Injectable()
export class CloudTokenStore {
  private readonly logger = new Logger(CloudTokenStore.name);
  private warnedMissingKey = false;

  constructor(
    private readonly config: ConfigService,
    private readonly redis: RedisService,
  ) {}

  private get encryptionKey(): string {
    const cloud = (this.config.get<string>('CLOUD_TOKEN_ENCRYPTION_KEY') ?? '').trim();
    if (cloud) return cloud;
    return (this.config.get<string>('GOOGLE_TOKEN_ENCRYPTION_KEY') ?? '').trim();
  }

  assertEncryptionReady(providerLabel = 'Cloud'): void {
    const key = this.encryptionKey;
    const isProd = this.config.get<string>('NODE_ENV') === 'production';
    if (isProd && key.length < 32) {
      throw new ServiceUnavailableException({
        error: `${providerLabel} requires GOOGLE_TOKEN_ENCRYPTION_KEY or CLOUD_TOKEN_ENCRYPTION_KEY (32+ chars) in production.`,
        code: 'CLOUD_ENCRYPTION_REQUIRED',
      });
    }
  }

  stateKey(provider: string, state: string): string {
    return `${provider}:oauth_state:${state}`;
  }

  tokenKey(provider: string, sessionId: string): string {
    return `${provider}:tokens:${sessionId}`;
  }

  async saveState(
    provider: string,
    state: string,
    sessionId: string,
  ): Promise<void> {
    await this.redis.client.set(
      this.stateKey(provider, state),
      sessionId,
      'EX',
      STATE_TTL_SEC,
    );
  }

  async consumeState(
    provider: string,
    state: string,
  ): Promise<string | null> {
    const key = this.stateKey(provider, state);
    const sessionId = await this.redis.client.get(key);
    if (sessionId) await this.redis.client.del(key);
    return sessionId;
  }

  async storeTokens(
    provider: string,
    sessionId: string,
    tokens: {
      refreshToken: string;
      accessToken?: string;
      expiresIn?: number;
    },
  ): Promise<void> {
    this.assertEncryptionReady(provider);
    const existing = await this.getTokens(provider, sessionId);
    const record: CloudTokenRecord = {
      refreshToken:
        tokens.refreshToken || existing?.refreshToken || '',
      accessToken: tokens.accessToken,
      accessExpiresAt: tokens.expiresIn
        ? Date.now() + tokens.expiresIn * 1000 - 30_000
        : existing?.accessExpiresAt,
      connectedAt: existing?.connectedAt ?? Date.now(),
    };
    await this.redis.client.set(
      this.tokenKey(provider, sessionId),
      this.serialize(record),
      'EX',
      TOKEN_TTL_SEC,
    );
  }

  async getTokens(
    provider: string,
    sessionId: string,
  ): Promise<CloudTokenRecord | null> {
    const raw = await this.redis.client.get(this.tokenKey(provider, sessionId));
    if (!raw) return null;
    try {
      return this.deserialize(raw);
    } catch (err) {
      this.logger.error(
        `Failed to deserialize ${provider} tokens: ${err instanceof Error ? err.message : err}`,
      );
      return null;
    }
  }

  async clearTokens(provider: string, sessionId: string): Promise<void> {
    await this.redis.client.del(this.tokenKey(provider, sessionId));
  }

  private serialize(record: CloudTokenRecord): string {
    const key = this.encryptionKey;
    let refreshToken = record.refreshToken;
    let accessToken = record.accessToken;
    if (key.length >= 32) {
      if (refreshToken) refreshToken = encryptToken(refreshToken, key);
      if (accessToken) accessToken = encryptToken(accessToken, key);
    } else if (!this.warnedMissingKey) {
      this.warnedMissingKey = true;
      this.logger.warn(
        'Cloud token encryption key missing or short — storing tokens unencrypted (dev only)',
      );
    }
    return JSON.stringify({ ...record, refreshToken, accessToken });
  }

  private deserialize(raw: string): CloudTokenRecord {
    const parsed = JSON.parse(raw) as CloudTokenRecord;
    const key = this.encryptionKey;
    let refreshToken = parsed.refreshToken ?? '';
    let accessToken = parsed.accessToken;
    if (key.length >= 32) {
      try {
        if (refreshToken) refreshToken = decryptToken(refreshToken, key);
      } catch {
        // plaintext legacy
      }
      try {
        if (accessToken) accessToken = decryptToken(accessToken, key);
      } catch {
        // ignore
      }
    }
    return { ...parsed, refreshToken, accessToken };
  }
}
