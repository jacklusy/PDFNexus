import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../redis/redis.service';
import {
  isCloudTokenEncryptionConfigured,
  resolveCloudTokenEncryptionKey,
} from './encryption-key';
import type { CloudTokenRecord } from './cloud-provider';
import {
  deserializeCloudTokenRecord,
  serializeCloudTokenRecord,
} from './oauth-token-store';

export type { CloudTokenRecord };

const TOKEN_TTL_SEC = 60 * 24 * 60 * 60;
const STATE_TTL_SEC = 10 * 60;

/**
 * Encrypted Redis token store shared by Dropbox / OneDrive.
 * Production requires CLOUD_TOKEN_ENCRYPTION_KEY or GOOGLE_TOKEN_ENCRYPTION_KEY ≥32 chars.
 */
@Injectable()
export class CloudTokenStore {
  private readonly logger = new Logger(CloudTokenStore.name);
  private warnedMissingKey = { current: false };

  constructor(
    private readonly config: ConfigService,
    private readonly redis: RedisService,
  ) {}

  private get encryptionKey(): string {
    return resolveCloudTokenEncryptionKey(this.config);
  }

  assertEncryptionReady(providerLabel = 'Cloud'): void {
    const key = this.encryptionKey;
    const isProd = this.config.get<string>('NODE_ENV') === 'production';
    if (isProd && !isCloudTokenEncryptionConfigured(key)) {
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

  /** Atomic get-and-delete of OAuth state. */
  async consumeState(
    provider: string,
    state: string,
  ): Promise<string | null> {
    const key = this.stateKey(provider, state);
    const sessionId = await this.redis.client.getdel(key);
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
      refreshToken: tokens.refreshToken || existing?.refreshToken || '',
      accessToken: tokens.accessToken,
      accessExpiresAt: tokens.expiresIn
        ? Date.now() + tokens.expiresIn * 1000 - 30_000
        : existing?.accessExpiresAt,
      connectedAt: existing?.connectedAt ?? Date.now(),
    };
    await this.redis.client.set(
      this.tokenKey(provider, sessionId),
      serializeCloudTokenRecord(
        record,
        this.encryptionKey,
        this.logger,
        this.warnedMissingKey,
        provider,
      ),
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
      return deserializeCloudTokenRecord(raw, this.encryptionKey);
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
}
