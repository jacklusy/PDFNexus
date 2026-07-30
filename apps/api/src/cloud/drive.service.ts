import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ErrorCodes } from '@pdfnexus/shared';
import { GoogleOAuthService } from './google-oauth.service';

export interface DriveFileListItem {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  size?: string;
  webViewLink?: string;
}

@Injectable()
export class DriveService {
  constructor(private readonly oauth: GoogleOAuthService) {}

  async isConnected(sessionId: string): Promise<boolean> {
    if (!this.oauth.isConfigured()) return false;
    const record = await this.oauth.getTokenRecord(sessionId);
    return Boolean(record?.refreshToken || record?.accessToken);
  }

  async disconnect(sessionId: string): Promise<void> {
    await this.oauth.clearTokens(sessionId);
  }

  private async requireAccessToken(sessionId: string): Promise<string> {
    this.oauth.assertConfigured();
    const token = await this.oauth.getAccessToken(sessionId);
    if (!token) {
      throw new UnauthorizedException({
        error: 'Google Drive is not connected for this session',
        code: ErrorCodes.AUTH_REQUIRED,
      });
    }
    return token;
  }

  async listPdfFiles(
    sessionId: string,
    query?: string,
  ): Promise<DriveFileListItem[]> {
    const accessToken = await this.requireAccessToken(sessionId);

    const qParts = [
      "mimeType='application/pdf'",
      'trashed=false',
    ];
    if (query?.trim()) {
      const safe = query.trim().replace(/\\/g, '\\\\').replace(/'/g, "\\'");
      qParts.push(`name contains '${safe}'`);
    }

    const params = new URLSearchParams({
      q: qParts.join(' and '),
      pageSize: '50',
      fields:
        'files(id,name,mimeType,modifiedTime,size,webViewLink)',
      spaces: 'drive',
      orderBy: 'modifiedTime desc',
    });

    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files?${params.toString()}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );

    if (!res.ok) {
      throw await this.driveError(res, 'Failed to list Drive files');
    }

    const json = (await res.json()) as {
      files?: DriveFileListItem[];
    };
    return json.files ?? [];
  }

  async importFile(
    sessionId: string,
    fileId: string,
  ): Promise<{ buffer: Buffer; name: string; mimeType: string }> {
    if (!fileId?.trim()) {
      throw new BadRequestException({
        error: 'fileId is required',
        code: ErrorCodes.VALIDATION_ERROR,
      });
    }

    const accessToken = await this.requireAccessToken(sessionId);

    const metaRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=id,name,mimeType`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!metaRes.ok) {
      throw await this.driveError(metaRes, 'Failed to fetch Drive file metadata');
    }
    const meta = (await metaRes.json()) as {
      name?: string;
      mimeType?: string;
    };

    const contentRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!contentRes.ok) {
      throw await this.driveError(contentRes, 'Failed to download Drive file');
    }

    const ab = await contentRes.arrayBuffer();
    return {
      buffer: Buffer.from(ab),
      name: meta.name || 'document.pdf',
      mimeType: meta.mimeType || 'application/pdf',
    };
  }

  async exportFile(
    sessionId: string,
    file: Express.Multer.File,
  ): Promise<{ id: string; name: string; webViewLink: string }> {
    if (!file?.buffer?.length) {
      throw new BadRequestException({
        error: 'A file is required',
        code: ErrorCodes.FILE_INVALID,
      });
    }

    const accessToken = await this.requireAccessToken(sessionId);
    const name = file.originalname || 'document.pdf';
    const mimeType = file.mimetype || 'application/pdf';

    const metadata = JSON.stringify({
      name,
      mimeType,
    });

    const boundary = `pdfnexus_${Date.now().toString(36)}`;
    const preamble = Buffer.from(
      `--${boundary}\r\n` +
        `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
        `${metadata}\r\n` +
        `--${boundary}\r\n` +
        `Content-Type: ${mimeType}\r\n\r\n`,
      'utf8',
    );
    const epilogue = Buffer.from(`\r\n--${boundary}--`, 'utf8');
    const body = Buffer.concat([preamble, file.buffer, epilogue]);

    const res = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body,
      },
    );

    if (!res.ok) {
      throw await this.driveError(res, 'Failed to upload file to Drive');
    }

    const json = (await res.json()) as {
      id?: string;
      name?: string;
      webViewLink?: string;
    };

    return {
      id: json.id || '',
      name: json.name || name,
      webViewLink: json.webViewLink || '',
    };
  }

  private async driveError(
    res: Response,
    fallback: string,
  ): Promise<ServiceUnavailableException | UnauthorizedException> {
    let detail = fallback;
    try {
      const json = (await res.json()) as {
        error?: { message?: string };
      };
      if (json.error?.message) detail = json.error.message;
    } catch {
      // ignore
    }

    if (res.status === 401 || res.status === 403) {
      return new UnauthorizedException({
        error: detail,
        code: ErrorCodes.AUTH_REQUIRED,
      });
    }

    return new ServiceUnavailableException({
      error: detail,
      code: 'DRIVE_REQUEST_FAILED',
    });
  }
}
