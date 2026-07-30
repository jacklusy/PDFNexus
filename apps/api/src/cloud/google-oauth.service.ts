import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import { RedisService } from '../redis/redis.service';
import { decryptToken, encryptToken } from './token-crypto';

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const TOKEN_TTL_SEC = 60 * 24 * 60 * 60; // 60 days
const STATE_TTL_SEC = 10 * 60;

export interface DriveTokenRecord {
  refreshToken: string;
  accessToken?: string;
  accessExpiresAt?: number;
  connectedAt: number;
}

@Injectable()
export class GoogleOAuthService {
  private readonly logger = new Logger(GoogleOAuthService.name);
  private warnedMissingKey = false;

  constructor(
    private readonly config: ConfigService,
    private readonly redis: RedisService,
  ) {}

  get clientId(): string {
    return (this.config.get<string>('GOOGLE_CLIENT_ID') ?? '').trim();
  }

  get clientSecret(): string {
    return (this.config.get<string>('GOOGLE_CLIENT_SECRET') ?? '').trim();
  }

  get redirectUri(): string {
    return (
      this.config.get<string>('GOOGLE_REDIRECT_URI') ??
      'http://localhost:4000/api/cloud/drive/callback'
    );
  }

  private get encryptionKey(): string {
    return (this.config.get<string>('GOOGLE_TOKEN_ENCRYPTION_KEY') ?? '').trim();
  }

  assertConfigured(): void {
    if (!this.clientId) {
      throw new ServiceUnavailableException({
        error:
          'Google Drive is not configured. Set GOOGLE_CLIENT_ID (and related env vars) to enable it.',
        code: 'DRIVE_UNAVAILABLE',
      });
    }
  }

  /** Production must encrypt tokens at rest. */
  assertEncryptionReady(): void {
    const key = this.encryptionKey;
    const isProd = this.config.get<string>('NODE_ENV') === 'production';
    if (isProd && key.length < 32) {
      throw new ServiceUnavailableException({
        error:
          'GOOGLE_TOKEN_ENCRYPTION_KEY (32+ chars) is required in production for Drive tokens.',
        code: 'DRIVE_ENCRYPTION_REQUIRED',
      });
    }
  }

  isConfigured(): boolean {
    return Boolean(this.clientId);
  }

  tokenRedisKey(sessionId: string): string {
    return `drive:tokens:${sessionId}`;
  }

  stateRedisKey(state: string): string {
    return `drive:oauth_state:${state}`;
  }

  async createAuthUrl(sessionId: string): Promise<string> {
    this.assertConfigured();
    const state = randomBytes(24).toString('hex');
    await this.redis.client.set(
      this.stateRedisKey(state),
      sessionId,
      'EX',
      STATE_TTL_SEC,
    );

    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: DRIVE_SCOPE,
      access_type: 'offline',
      prompt: 'consent',
      state,
      include_granted_scopes: 'true',
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  async consumeState(state: string): Promise<string | null> {
    const key = this.stateRedisKey(state);
    const sessionId = await this.redis.client.get(key);
    if (sessionId) {
      await this.redis.client.del(key);
    }
    return sessionId;
  }

  async exchangeCode(code: string): Promise<{
    refreshToken: string;
    accessToken: string;
    expiresIn: number;
  }> {
    this.assertConfigured();
    const body = new URLSearchParams({
      code,
      client_id: this.clientId,
      client_secret: this.clientSecret,
      redirect_uri: this.redirectUri,
      grant_type: 'authorization_code',
    });

    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    const json = (await res.json()) as Record<string, unknown>;
    if (!res.ok) {
      const msg =
        typeof json.error_description === 'string'
          ? json.error_description
          : typeof json.error === 'string'
            ? json.error
            : 'OAuth token exchange failed';
      throw new ServiceUnavailableException({
        error: msg,
        code: 'DRIVE_OAUTH_FAILED',
      });
    }

    const refreshToken =
      typeof json.refresh_token === 'string' ? json.refresh_token : '';
    const accessToken =
      typeof json.access_token === 'string' ? json.access_token : '';
    const expiresIn =
      typeof json.expires_in === 'number' ? json.expires_in : 3600;

    if (!accessToken) {
      throw new ServiceUnavailableException({
        error: 'Google did not return an access token',
        code: 'DRIVE_OAUTH_FAILED',
      });
    }

    return { refreshToken, accessToken, expiresIn };
  }

  async storeTokens(
    sessionId: string,
    tokens: {
      refreshToken: string;
      accessToken?: string;
      expiresIn?: number;
    },
  ): Promise<void> {
    this.assertEncryptionReady();
    const existing = await this.getTokenRecord(sessionId);
    const refresh =
      tokens.refreshToken || existing?.refreshToken || '';
    if (!refresh) {
      this.logger.warn(
        'No refresh token from Google; reusing existing or storing access-only session',
      );
    }

    const record: DriveTokenRecord = {
      refreshToken: refresh || existing?.refreshToken || '',
      accessToken: tokens.accessToken,
      accessExpiresAt: tokens.expiresIn
        ? Date.now() + tokens.expiresIn * 1000 - 30_000
        : existing?.accessExpiresAt,
      connectedAt: existing?.connectedAt ?? Date.now(),
    };

    const payload = this.serializeRecord(record);
    await this.redis.client.set(
      this.tokenRedisKey(sessionId),
      payload,
      'EX',
      TOKEN_TTL_SEC,
    );
  }

  async getTokenRecord(sessionId: string): Promise<DriveTokenRecord | null> {
    const raw = await this.redis.client.get(this.tokenRedisKey(sessionId));
    if (!raw) return null;
    try {
      return this.deserializeRecord(raw);
    } catch (err) {
      this.logger.error(
        `Failed to deserialize Drive tokens: ${err instanceof Error ? err.message : err}`,
      );
      return null;
    }
  }

  async clearTokens(sessionId: string): Promise<void> {
    await this.redis.client.del(this.tokenRedisKey(sessionId));
  }

  async getAccessToken(sessionId: string): Promise<string | null> {
    const record = await this.getTokenRecord(sessionId);
    if (!record) return null;

    if (
      record.accessToken &&
      record.accessExpiresAt &&
      record.accessExpiresAt > Date.now()
    ) {
      return record.accessToken;
    }

    if (!record.refreshToken) return null;

    this.assertConfigured();
    const body = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      refresh_token: record.refreshToken,
      grant_type: 'refresh_token',
    });

    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    const json = (await res.json()) as Record<string, unknown>;
    if (!res.ok) {
      this.logger.warn(
        `Drive token refresh failed: ${typeof json.error === 'string' ? json.error : res.status}`,
      );
      return null;
    }

    const accessToken =
      typeof json.access_token === 'string' ? json.access_token : null;
    const expiresIn =
      typeof json.expires_in === 'number' ? json.expires_in : 3600;

    if (!accessToken) return null;

    await this.storeTokens(sessionId, {
      refreshToken: record.refreshToken,
      accessToken,
      expiresIn,
    });

    return accessToken;
  }

  private serializeRecord(record: DriveTokenRecord): string {
    this.assertEncryptionReady();
    const key = this.encryptionKey;
    let refreshToken = record.refreshToken;
    let accessToken = record.accessToken;
    if (key.length >= 32) {
      if (refreshToken) refreshToken = encryptToken(refreshToken, key);
      if (accessToken) accessToken = encryptToken(accessToken, key);
    } else if (!this.warnedMissingKey) {
      this.warnedMissingKey = true;
      this.logger.warn(
        'GOOGLE_TOKEN_ENCRYPTION_KEY missing or shorter than 32 chars — storing Drive tokens unencrypted (dev only)',
      );
    }

    return JSON.stringify({
      ...record,
      refreshToken,
      accessToken,
    });
  }

  private deserializeRecord(raw: string): DriveTokenRecord {
    const parsed = JSON.parse(raw) as DriveTokenRecord;
    const key = this.encryptionKey;
    let refreshToken = parsed.refreshToken ?? '';
    let accessToken = parsed.accessToken;
    if (key.length >= 32) {
      try {
        if (refreshToken) refreshToken = decryptToken(refreshToken, key);
      } catch {
        // May be plaintext from before key was set
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
