import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import { ErrorCodes } from '@pdfnexus/shared';
import { MAX_CLOUD_FILE_BYTES, isCloudPdfMeta, isCloudTokenConnected, isPdfMagic, isPdfUpload, isUnderOneDriveApproot, readCloudBodyCapped } from './cloud-constants';
import { CloudTokenStore } from './cloud-token-store';

const PROVIDER = 'onedrive';
/** App-folder only — not full library Files.ReadWrite. */
const SCOPES = 'offline_access Files.ReadWrite.AppFolder';

@Injectable()
export class OneDriveOAuthService {
  constructor(
    private readonly config: ConfigService,
    private readonly tokens: CloudTokenStore,
  ) {}

  get clientId(): string {
    return (this.config.get<string>('MICROSOFT_CLIENT_ID') ?? '').trim();
  }

  get clientSecret(): string {
    return (this.config.get<string>('MICROSOFT_CLIENT_SECRET') ?? '').trim();
  }

  get tenant(): string {
    return (this.config.get<string>('MICROSOFT_TENANT') ?? 'common').trim() || 'common';
  }

  get redirectUri(): string {
    return (
      this.config.get<string>('MICROSOFT_REDIRECT_URI') ??
      'http://localhost:4000/api/cloud/onedrive/callback'
    );
  }

  isConfigured(): boolean {
    return Boolean(this.clientId && this.clientSecret);
  }

  assertConfigured(): void {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException({
        error:
          'OneDrive is not configured. Set MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET.',
        code: 'ONEDRIVE_UNAVAILABLE',
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
      response_mode: 'query',
      scope: SCOPES,
      state,
    });
    return `https://login.microsoftonline.com/${this.tenant}/oauth2/v2.0/authorize?${params.toString()}`;
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
      scope: SCOPES,
    });
    const res = await fetch(
      `https://login.microsoftonline.com/${this.tenant}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      },
    );
    const json = (await res.json()) as Record<string, unknown>;
    if (!res.ok || typeof json.access_token !== 'string') {
      throw new ServiceUnavailableException({
        error: 'Microsoft OAuth token exchange failed',
        code: 'ONEDRIVE_OAUTH_FAILED',
      });
    }
    return {
      accessToken: json.access_token,
      refreshToken:
        typeof json.refresh_token === 'string' ? json.refresh_token : '',
      expiresIn: typeof json.expires_in === 'number' ? json.expires_in : 3600,
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

  /**
   * Microsoft identity has no RFC 7009 revoke for delegated refresh tokens.
   * Disconnect clears Redis only; this no-op exists for API symmetry with Google/Dropbox.
   */
  async revokeAccess(_sessionId: string): Promise<void> {
    /* clear-local-only — no provider revoke endpoint for confidential delegated tokens */
  }

  async getAccessToken(sessionId: string): Promise<string | null> {
    this.tokens.assertEncryptionReady('OneDrive');
    const record = await this.tokens.getTokens(PROVIDER, sessionId);
    if (!record) return null;
    if (
      record.accessToken &&
      record.accessExpiresAt &&
      record.accessExpiresAt > Date.now()
    ) {
      return record.accessToken;
    }
    if (!record.refreshToken) return null;

    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: record.refreshToken,
      client_id: this.clientId,
      client_secret: this.clientSecret,
      scope: SCOPES,
    });
    const res = await fetch(
      `https://login.microsoftonline.com/${this.tenant}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      },
    );
    const json = (await res.json()) as Record<string, unknown>;
    if (!res.ok || typeof json.access_token !== 'string') return null;
    const accessToken = json.access_token;
    const expiresIn =
      typeof json.expires_in === 'number' ? json.expires_in : 3600;
    const refresh =
      typeof json.refresh_token === 'string'
        ? json.refresh_token
        : record.refreshToken;
    await this.tokens.storeTokens(PROVIDER, sessionId, {
      refreshToken: refresh,
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
export class OneDriveService {
  constructor(private readonly oauth: OneDriveOAuthService) {}

  private async requireToken(sessionId: string): Promise<string> {
    this.oauth.assertConfigured();
    const token = await this.oauth.getAccessToken(sessionId);
    if (!token) {
      throw new UnauthorizedException({
        error: 'OneDrive is not connected for this session',
        code: ErrorCodes.AUTH_REQUIRED,
      });
    }
    return token;
  }

  async listPdfFiles(sessionId: string) {
    const token = await this.requireToken(sessionId);
    const res = await fetch(
      `https://graph.microsoft.com/v1.0/me/drive/special/approot/children?$top=50&$select=id,name,size,webUrl,file`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!res.ok) {
      throw new ServiceUnavailableException({
        error: 'Failed to list OneDrive app-folder files',
        code: 'ONEDRIVE_REQUEST_FAILED',
      });
    }
    const data = (await res.json()) as {
      value?: Array<{
        id?: string;
        name?: string;
        size?: number;
        webUrl?: string;
        file?: unknown;
      }>;
    };
    return (data.value ?? [])
      .filter((f) => f.id && f.name?.toLowerCase().endsWith('.pdf'))
      .map((f) => ({
        id: f.id!,
        name: f.name!,
        mimeType: 'application/pdf',
        size: f.size != null ? String(f.size) : undefined,
        webViewLink: f.webUrl,
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

    const [metaRes, approotRes] = await Promise.all([
      fetch(
        `https://graph.microsoft.com/v1.0/me/drive/items/${encodeURIComponent(fileId)}?$select=id,name,size,file,parentReference`,
        { headers: { Authorization: `Bearer ${token}` } },
      ),
      fetch(
        `https://graph.microsoft.com/v1.0/me/drive/special/approot?$select=id,name`,
        { headers: { Authorization: `Bearer ${token}` } },
      ),
    ]);
    if (!metaRes.ok) {
      throw new ServiceUnavailableException({
        error: 'Failed to fetch OneDrive file metadata',
        code: 'ONEDRIVE_REQUEST_FAILED',
      });
    }
    if (!approotRes.ok) {
      throw new ServiceUnavailableException({
        error: 'Failed to resolve OneDrive app folder',
        code: 'ONEDRIVE_REQUEST_FAILED',
      });
    }
    const meta = (await metaRes.json()) as {
      id?: string;
      name?: string;
      size?: number;
      file?: { mimeType?: string };
      parentReference?: { id?: string; path?: string };
    };
    const approot = (await approotRes.json()) as { id?: string; name?: string };

    // Defense-in-depth: parent is approot, or path under /Apps/{name}/ (segment-safe).
    const underApproot = isUnderOneDriveApproot({
      approotId: approot.id,
      approotName: approot.name,
      parentId: meta.parentReference?.id,
      parentPath: meta.parentReference?.path,
    });
    if (!underApproot) {
      throw new BadRequestException({
        error: 'Only files in the OneDrive app folder can be imported',
        code: ErrorCodes.FILE_INVALID,
      });
    }

    if (
      !isCloudPdfMeta({
        name: meta.name,
        mimeType: meta.file?.mimeType,
      })
    ) {
      throw new BadRequestException({
        error: 'Only PDF files can be imported from OneDrive',
        code: ErrorCodes.FILE_INVALID,
      });
    }

    if (meta.size != null && meta.size > MAX_CLOUD_FILE_BYTES) {
      throw new BadRequestException({
        error: 'File exceeds the 50MB cloud import limit',
        code: ErrorCodes.FILE_TOO_LARGE,
      });
    }
    const contentRes = await fetch(
      `https://graph.microsoft.com/v1.0/me/drive/items/${encodeURIComponent(fileId)}/content`,
      { headers: { Authorization: `Bearer ${token}` }, redirect: 'follow' },
    );
    if (!contentRes.ok) {
      throw new ServiceUnavailableException({
        error: 'Failed to download OneDrive file',
        code: 'ONEDRIVE_REQUEST_FAILED',
      });
    }
    let buffer: Buffer;
    try {
      buffer = await readCloudBodyCapped(contentRes, MAX_CLOUD_FILE_BYTES);
    } catch (err) {
      const code = (err as { code?: string })?.code;
      if (code === 'TOO_LARGE') {
        throw new BadRequestException({
          error: 'File exceeds the 50MB cloud import limit',
          code: ErrorCodes.FILE_TOO_LARGE,
        });
      }
      throw new BadRequestException({
        error: 'Invalid or empty OneDrive file',
        code: ErrorCodes.FILE_INVALID,
      });
    }
    if (!isPdfMagic(buffer)) {
      throw new BadRequestException({
        error: 'Only PDF files can be imported from OneDrive',
        code: ErrorCodes.FILE_INVALID,
      });
    }
    return {
      buffer,
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
    if (!isPdfUpload(file) || !isPdfMagic(file.buffer)) {
      throw new BadRequestException({
        error: 'Only PDF files can be exported to OneDrive',
        code: ErrorCodes.FILE_INVALID,
      });
    }
    const token = await this.requireToken(sessionId);
    const name = encodeURIComponent(file.originalname || 'document.pdf');
    const res = await fetch(
      `https://graph.microsoft.com/v1.0/me/drive/special/approot:/${name}:/content`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/pdf',
        },
        body: file.buffer,
      },
    );
    if (!res.ok) {
      throw new ServiceUnavailableException({
        error: 'Failed to upload file to OneDrive app folder',
        code: 'ONEDRIVE_REQUEST_FAILED',
      });
    }
    const json = (await res.json()) as {
      id?: string;
      name?: string;
      webUrl?: string;
    };
    return {
      id: json.id || '',
      name: json.name || file.originalname || 'document.pdf',
      webViewLink: json.webUrl || '',
    };
  }
}
