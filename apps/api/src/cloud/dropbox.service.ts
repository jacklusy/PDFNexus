import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import { ErrorCodes } from '@pdfnexus/shared';
import {
  MAX_CLOUD_FILE_BYTES,
  isCloudPdfMeta,
  isCloudTokenConnected,
  isPdfUpload,
} from './cloud-constants';
import { CloudTokenStore } from './cloud-token-store';

const PROVIDER = 'dropbox';
/**
 * App-folder Dropbox apps root the API at the app folder.
 * Do not use full-account search — list the app-folder root only.
 */
const SCOPES = 'files.content.read files.content.write';

@Injectable()
export class DropboxOAuthService {
  constructor(
    private readonly config: ConfigService,
    private readonly tokens: CloudTokenStore,
  ) {}

  get clientId(): string {
    return (this.config.get<string>('DROPBOX_CLIENT_ID') ?? '').trim();
  }

  get clientSecret(): string {
    return (this.config.get<string>('DROPBOX_CLIENT_SECRET') ?? '').trim();
  }

  get redirectUri(): string {
    return (
      this.config.get<string>('DROPBOX_REDIRECT_URI') ??
      'http://localhost:4000/api/cloud/dropbox/callback'
    );
  }

  isConfigured(): boolean {
    return Boolean(this.clientId && this.clientSecret);
  }

  assertConfigured(): void {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException({
        error:
          'Dropbox is not configured. Set DROPBOX_CLIENT_ID and DROPBOX_CLIENT_SECRET.',
        code: 'DROPBOX_UNAVAILABLE',
      });
    }
  }

  async createAuthUrl(sessionId: string): Promise<string> {
    this.assertConfigured();
    const state = randomBytes(24).toString('hex');
    await this.tokens.saveState(PROVIDER, state, sessionId);
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      token_access_type: 'offline',
      scope: SCOPES,
      state,
    });
    return `https://www.dropbox.com/oauth2/authorize?${params.toString()}`;
  }

  async consumeState(state: string): Promise<string | null> {
    return this.tokens.consumeState(PROVIDER, state);
  }

  async exchangeCode(code: string): Promise<{
    refreshToken: string;
    accessToken: string;
    expiresIn: number;
  }> {
    this.assertConfigured();
    const body = new URLSearchParams({
      code,
      grant_type: 'authorization_code',
      client_id: this.clientId,
      client_secret: this.clientSecret,
      redirect_uri: this.redirectUri,
    });
    const res = await fetch('https://api.dropboxapi.com/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    const json = (await res.json()) as Record<string, unknown>;
    if (!res.ok || typeof json.access_token !== 'string') {
      throw new ServiceUnavailableException({
        error: 'Dropbox OAuth token exchange failed',
        code: 'DROPBOX_OAUTH_FAILED',
      });
    }
    return {
      accessToken: json.access_token,
      refreshToken:
        typeof json.refresh_token === 'string' ? json.refresh_token : '',
      expiresIn: typeof json.expires_in === 'number' ? json.expires_in : 14400,
    };
  }

  async storeTokens(
    sessionId: string,
    tokens: {
      refreshToken: string;
      accessToken?: string;
      expiresIn?: number;
    },
  ): Promise<void> {
    await this.tokens.storeTokens(PROVIDER, sessionId, tokens);
  }

  async clearTokens(sessionId: string): Promise<void> {
    await this.tokens.clearTokens(PROVIDER, sessionId);
  }

  /** Best-effort Dropbox token revoke; always clears Redis afterward via caller. */
  async revokeAccess(sessionId: string): Promise<void> {
    try {
      const token = await this.getAccessToken(sessionId);
      if (!token) return;
      await fetch('https://api.dropboxapi.com/2/auth/token/revoke', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      /* fail soft */
    }
  }

  async getAccessToken(sessionId: string): Promise<string | null> {
    this.tokens.assertEncryptionReady('Dropbox');
    const record = await this.tokens.getTokens(PROVIDER, sessionId);
    if (!record) return null;
    if (
      record.accessToken &&
      record.accessExpiresAt &&
      record.accessExpiresAt > Date.now()
    ) {
      return record.accessToken;
    }
    if (!record.refreshToken) return record.accessToken || null;

    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: record.refreshToken,
      client_id: this.clientId,
      client_secret: this.clientSecret,
    });
    const res = await fetch('https://api.dropboxapi.com/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    const json = (await res.json()) as Record<string, unknown>;
    if (!res.ok || typeof json.access_token !== 'string') {
      return null;
    }
    const accessToken = json.access_token;
    const expiresIn =
      typeof json.expires_in === 'number' ? json.expires_in : 14400;
    await this.tokens.storeTokens(PROVIDER, sessionId, {
      refreshToken: record.refreshToken,
      accessToken,
      expiresIn,
    });
    return accessToken;
  }

  async isConnected(sessionId: string): Promise<boolean> {
    if (!this.isConfigured()) return false;
    const record = await this.tokens.getTokens(PROVIDER, sessionId);
    return isCloudTokenConnected(record);
  }
}

@Injectable()
export class DropboxService {
  constructor(private readonly oauth: DropboxOAuthService) {}

  private async requireToken(sessionId: string): Promise<string> {
    this.oauth.assertConfigured();
    const token = await this.oauth.getAccessToken(sessionId);
    if (!token) {
      throw new UnauthorizedException({
        error: 'Dropbox is not connected for this session',
        code: ErrorCodes.AUTH_REQUIRED,
      });
    }
    return token;
  }

  /** Lists PDFs in the Dropbox app folder root (App Folder permission). */
  async listPdfFiles(sessionId: string) {
    const token = await this.requireToken(sessionId);
    const entries: Array<{
      ['.tag']?: string;
      id?: string;
      name?: string;
      size?: number;
      path_display?: string;
    }> = [];
    let cursor: string | undefined;
    let hasMore = true;

    while (hasMore && entries.length < 100) {
      const res = await fetch(
        cursor
          ? 'https://api.dropboxapi.com/2/files/list_folder/continue'
          : 'https://api.dropboxapi.com/2/files/list_folder',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(
            cursor
              ? { cursor }
              : { path: '', recursive: false, limit: 100 },
          ),
        },
      );
      if (!res.ok) {
        throw new ServiceUnavailableException({
          error: 'Failed to list Dropbox app folder',
          code: 'DROPBOX_REQUEST_FAILED',
        });
      }
      const json = (await res.json()) as {
        entries?: typeof entries;
        cursor?: string;
        has_more?: boolean;
      };
      entries.push(...(json.entries ?? []));
      hasMore = Boolean(json.has_more);
      cursor = json.cursor;
    }

    return entries
      .filter(
        (f) =>
          f['.tag'] === 'file' &&
          Boolean(f.id) &&
          Boolean(f.name?.toLowerCase().endsWith('.pdf')),
      )
      .slice(0, 50)
      .map((f) => ({
        id: f.id!,
        name: f.name!,
        mimeType: 'application/pdf',
        size: f.size != null ? String(f.size) : undefined,
        webViewLink: f.path_display,
      }));
  }

  async importFile(sessionId: string, fileId: string) {
    if (!fileId?.trim()) {
      throw new BadRequestException({
        error: 'fileId is required',
        code: ErrorCodes.VALIDATION_ERROR,
      });
    }
    const token = await this.requireToken(sessionId);

    const metaRes = await fetch(
      'https://api.dropboxapi.com/2/files/get_metadata',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ path: fileId }),
      },
    );
    if (!metaRes.ok) {
      throw new ServiceUnavailableException({
        error: 'Failed to fetch Dropbox file metadata',
        code: 'DROPBOX_REQUEST_FAILED',
      });
    }
    const meta = (await metaRes.json()) as {
      name?: string;
      size?: number;
      ['.tag']?: string;
      path_display?: string;
    };
    if (meta['.tag'] === 'folder') {
      throw new BadRequestException({
        error: 'Cannot import a Dropbox folder',
        code: ErrorCodes.FILE_INVALID,
      });
    }
    if (!isCloudPdfMeta({ name: meta.name })) {
      throw new BadRequestException({
        error: 'Only PDF files can be imported from Dropbox',
        code: ErrorCodes.FILE_INVALID,
      });
    }
    if (meta.size != null && meta.size > MAX_CLOUD_FILE_BYTES) {
      throw new BadRequestException({
        error: 'File exceeds the 50MB cloud import limit',
        code: ErrorCodes.FILE_TOO_LARGE,
      });
    }

    const res = await fetch(
      'https://content.dropboxapi.com/2/files/download',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Dropbox-API-Arg': JSON.stringify({ path: fileId }),
        },
      },
    );
    if (!res.ok) {
      throw new ServiceUnavailableException({
        error: 'Failed to download Dropbox file',
        code: 'DROPBOX_REQUEST_FAILED',
      });
    }
    const ab = await res.arrayBuffer();
    if (ab.byteLength > MAX_CLOUD_FILE_BYTES) {
      throw new BadRequestException({
        error: 'File exceeds the 50MB cloud import limit',
        code: ErrorCodes.FILE_TOO_LARGE,
      });
    }
    return {
      buffer: Buffer.from(ab),
      name: meta.name || 'document.pdf',
      mimeType: 'application/pdf',
    };
  }

  async exportFile(sessionId: string, file: Express.Multer.File) {
    if (!file?.buffer?.length) {
      throw new BadRequestException({
        error: 'A file is required',
        code: ErrorCodes.FILE_INVALID,
      });
    }
    if (file.buffer.length > MAX_CLOUD_FILE_BYTES) {
      throw new BadRequestException({
        error: 'File exceeds the 50MB cloud export limit',
        code: ErrorCodes.FILE_TOO_LARGE,
      });
    }
    if (!isPdfUpload(file)) {
      throw new BadRequestException({
        error: 'Only PDF files can be exported to Dropbox',
        code: ErrorCodes.FILE_INVALID,
      });
    }
    const token = await this.requireToken(sessionId);
    const name = file.originalname || 'document.pdf';
    const path = `/${name.replace(/^\/+/, '')}`;
    const res = await fetch('https://content.dropboxapi.com/2/files/upload', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/octet-stream',
        'Dropbox-API-Arg': JSON.stringify({
          path,
          mode: 'add',
          autorename: true,
          mute: false,
        }),
      },
      body: file.buffer,
    });
    if (!res.ok) {
      throw new ServiceUnavailableException({
        error: 'Failed to upload file to Dropbox',
        code: 'DROPBOX_REQUEST_FAILED',
      });
    }
    const json = (await res.json()) as {
      id?: string;
      name?: string;
      path_display?: string;
    };
    return {
      id: json.id || '',
      name: json.name || name,
      webViewLink: json.path_display || path,
    };
  }
}
