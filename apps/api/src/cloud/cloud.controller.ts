import {
  BadRequestException,
  Body,
  Controller,
  Get,
  MaxFileSizeValidator,
  ParseFilePipe,
  Post,
  Query,
  Req,
  Res,
  StreamableFile,
  UnauthorizedException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Request, Response } from 'express';
import { randomBytes } from 'crypto';
import { ErrorCodes } from '@pdfnexus/shared';
import { SameOriginGuard } from '../ocr/same-origin.guard';
import { CookieService } from '../auth/cookie.service';
import { DriveService } from './drive.service';
import { MAX_CLOUD_FILE_BYTES } from './cloud-constants';
import { GoogleOAuthService } from './google-oauth.service';
import {
  DropboxOAuthService,
  DropboxService,
} from './dropbox.service';
import {
  OneDriveOAuthService,
  OneDriveService,
} from './onedrive.service';

const DRIVE_SESSION_COOKIE = 'drive_session';
const DROPBOX_SESSION_COOKIE = 'dropbox_session';
const ONEDRIVE_SESSION_COOKIE = 'onedrive_session';
const MAX_EXPORT_BYTES = MAX_CLOUD_FILE_BYTES;

@Controller('cloud')
export class CloudController {
  constructor(
    private readonly oauth: GoogleOAuthService,
    private readonly drive: DriveService,
    private readonly dropboxOauth: DropboxOAuthService,
    private readonly dropbox: DropboxService,
    private readonly onedriveOauth: OneDriveOAuthService,
    private readonly onedrive: OneDriveService,
    private readonly cookies: CookieService,
    private readonly config: ConfigService,
  ) {}

  private get isProduction(): boolean {
    return this.config.get<string>('NODE_ENV') === 'production';
  }

  private get appUrl(): string {
    return this.config.get<string>('APP_URL') ?? 'http://localhost:3000';
  }

  private readDriveSession(req: Request): string | null {
    const cookies = req.cookies as Record<string, string> | undefined;
    const value = cookies?.[DRIVE_SESSION_COOKIE];
    if (!value || value.length < 16) return null;
    return value;
  }

  private ensureDriveSession(req: Request, res: Response): string {
    const existing = this.readDriveSession(req);
    if (existing) return existing;
    const sessionId = randomBytes(24).toString('hex');
    this.setDriveSessionCookie(res, sessionId);
    return sessionId;
  }

  private setDriveSessionCookie(res: Response, sessionId: string): void {
    const ttlDays = this.config.get<number>('COOKIE_TTL_DAYS') ?? 60;
    res.cookie(DRIVE_SESSION_COOKIE, sessionId, {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.isProduction,
      maxAge: ttlDays * 24 * 60 * 60 * 1000,
      path: '/',
    });
  }

  private clearDriveSessionCookie(res: Response): void {
    res.clearCookie(DRIVE_SESSION_COOKIE, {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.isProduction,
      path: '/',
    });
  }

  /**
   * Prefer verified_email when present. Always use drive_session for Redis
   * token keys (set on auth-url / OAuth callback).
   */
  private requireSession(req: Request, res: Response): string {
    const verified = this.cookies.readVerifiedEmail(req);
    const driveSession = this.readDriveSession(req);
    if (!verified && !driveSession) {
      throw new UnauthorizedException({
        error:
          'A Drive session is required. Connect Google Drive first, or verify your email.',
        code: ErrorCodes.AUTH_REQUIRED,
      });
    }
    return this.ensureDriveSession(req, res);
  }

  @Get('drive/auth-url')
  @UseGuards(SameOriginGuard)
  async authUrl(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ url: string }> {
    this.oauth.assertConfigured();
    const sessionId = this.ensureDriveSession(req, res);
    const url = await this.oauth.createAuthUrl(sessionId);
    return { url };
  }

  /** OAuth redirect from Google — no SameOriginGuard (cross-site redirect). */
  @Get('drive/callback')
  async callback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') oauthError: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const redirectBase = `${this.appUrl.replace(/\/$/, '')}/workspace`;

    if (oauthError) {
      return res.redirect(
        302,
        `${redirectBase}?drive=error&reason=${encodeURIComponent(oauthError)}`,
      );
    }

    if (!code || !state) {
      return res.redirect(
        302,
        `${redirectBase}?drive=error&reason=missing_code`,
      );
    }

    try {
      this.oauth.assertConfigured();
      const stateSession = await this.oauth.consumeState(state);
      if (!stateSession) {
        return res.redirect(
          302,
          `${redirectBase}?drive=error&reason=invalid_state`,
        );
      }

      // Single Redis key only — always the OAuth state session.
      const sessionId = stateSession;
      this.setDriveSessionCookie(res, sessionId);

      const tokens = await this.oauth.exchangeCode(code);
      await this.oauth.storeTokens(sessionId, {
        refreshToken: tokens.refreshToken,
        accessToken: tokens.accessToken,
        expiresIn: tokens.expiresIn,
      });

      return res.redirect(302, `${redirectBase}?drive=connected`);
    } catch {
      return res.redirect(
        302,
        `${redirectBase}?drive=error&reason=exchange_failed`,
      );
    }
  }

  @Get('drive/status')
  @UseGuards(SameOriginGuard)
  async status(
    @Req() req: Request,
  ): Promise<{ connected: boolean }> {
    if (!this.oauth.isConfigured()) {
      return { connected: false };
    }
    const sessionId = this.readDriveSession(req);
    if (!sessionId) {
      return { connected: false };
    }
    const connected = await this.drive.isConnected(sessionId);
    return { connected };
  }

  @Post('drive/disconnect')
  @UseGuards(SameOriginGuard)
  async disconnect(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ ok: true }> {
    const sessionId = this.readDriveSession(req);
    if (sessionId) {
      await this.drive.disconnect(sessionId);
    }
    this.clearDriveSessionCookie(res);
    return { ok: true };
  }

  @Get('drive/picker-config')
  @UseGuards(SameOriginGuard)
  async pickerConfig(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{
    clientId: string;
    accessToken: string;
    developerKey?: string;
  }> {
    this.oauth.assertConfigured();
    this.oauth.assertEncryptionReady();
    const sessionId = this.requireSession(req, res);
    const accessToken = await this.oauth.getAccessToken(sessionId);
    if (!accessToken) {
      throw new UnauthorizedException({
        error: 'Google Drive is not connected for this session',
        code: ErrorCodes.AUTH_REQUIRED,
      });
    }
    const developerKey =
      this.config.get<string>('GOOGLE_API_KEY')?.trim() || undefined;
    return {
      clientId: this.oauth.clientId,
      accessToken,
      developerKey,
    };
  }

  @Get('drive/files')
  @UseGuards(SameOriginGuard)
  async listFiles(
    @Query('q') q: string | undefined,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const sessionId = this.requireSession(req, res);
    const files = await this.drive.listPdfFiles(sessionId, q);
    return { files };
  }

  @Post('drive/import')
  @UseGuards(SameOriginGuard)
  async importFile(
    @Body() body: { fileId?: string },
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const sessionId = this.requireSession(req, res);
    const fileId = body?.fileId?.trim();
    if (!fileId) {
      throw new BadRequestException({
        error: 'fileId is required',
        code: ErrorCodes.VALIDATION_ERROR,
      });
    }

    const file = await this.drive.importFile(sessionId, fileId);
    const safeName = file.name.replace(/[^\w.\-()+ ]+/g, '_').slice(0, 160);

    return new StreamableFile(file.buffer, {
      type: file.mimeType || 'application/pdf',
      disposition: `attachment; filename="${safeName}"`,
      length: file.buffer.length,
    });
  }

  @Post('drive/export')
  @UseGuards(SameOriginGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_EXPORT_BYTES, files: 1 },
    }),
  )
  async exportFile(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: MAX_EXPORT_BYTES }),
        ],
        fileIsRequired: true,
        exceptionFactory: (error) => {
          const msg =
            typeof error === 'string' ? error : 'Invalid file upload';
          if (/size|large|max/i.test(msg)) {
            return new BadRequestException({
              error: 'File exceeds the 50MB Drive export limit',
              code: ErrorCodes.FILE_TOO_LARGE,
            });
          }
          return new BadRequestException({
            error: 'A file is required',
            code: ErrorCodes.FILE_INVALID,
          });
        },
      }),
    )
    file: Express.Multer.File,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const sessionId = this.requireSession(req, res);
    return this.drive.exportFile(sessionId, file);
  }

  // ── Dropbox ──────────────────────────────────────────────

  private readProviderSession(req: Request, cookie: string): string | null {
    const cookies = req.cookies as Record<string, string> | undefined;
    const value = cookies?.[cookie];
    if (!value || value.length < 16) return null;
    return value;
  }

  private ensureProviderSession(
    req: Request,
    res: Response,
    cookie: string,
  ): string {
    const existing = this.readProviderSession(req, cookie);
    if (existing) return existing;
    const sessionId = randomBytes(24).toString('hex');
    this.setProviderSessionCookie(res, cookie, sessionId);
    return sessionId;
  }

  private setProviderSessionCookie(
    res: Response,
    cookie: string,
    sessionId: string,
  ): void {
    const ttlDays = this.config.get<number>('COOKIE_TTL_DAYS') ?? 60;
    res.cookie(cookie, sessionId, {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.isProduction,
      maxAge: ttlDays * 24 * 60 * 60 * 1000,
      path: '/',
    });
  }

  private clearProviderSessionCookie(res: Response, cookie: string): void {
    res.clearCookie(cookie, {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.isProduction,
      path: '/',
    });
  }

  private requireProviderSession(
    req: Request,
    res: Response,
    cookie: string,
  ): string {
    const driveSession = this.readProviderSession(req, cookie);
    if (!driveSession) {
      throw new UnauthorizedException({
        error: 'Cloud session required. Connect the provider first.',
        code: ErrorCodes.AUTH_REQUIRED,
      });
    }
    return this.ensureProviderSession(req, res, cookie);
  }

  @Get('dropbox/auth-url')
  @UseGuards(SameOriginGuard)
  async dropboxAuthUrl(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ url: string }> {
    this.dropboxOauth.assertConfigured();
    const sessionId = this.ensureProviderSession(
      req,
      res,
      DROPBOX_SESSION_COOKIE,
    );
    const url = await this.dropboxOauth.createAuthUrl(sessionId);
    return { url };
  }

  @Get('dropbox/callback')
  async dropboxCallback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') oauthError: string | undefined,
    @Res() res: Response,
  ) {
    const redirectBase = `${this.appUrl.replace(/\/$/, '')}/workspace`;
    if (oauthError || !code || !state) {
      return res.redirect(
        302,
        `${redirectBase}?dropbox=error&reason=${encodeURIComponent(oauthError || 'missing_code')}`,
      );
    }
    try {
      const sessionId = await this.dropboxOauth.consumeState(state);
      if (!sessionId) {
        return res.redirect(302, `${redirectBase}?dropbox=error&reason=invalid_state`);
      }
      this.setProviderSessionCookie(res, DROPBOX_SESSION_COOKIE, sessionId);
      const tokens = await this.dropboxOauth.exchangeCode(code);
      await this.dropboxOauth.storeTokens(sessionId, {
        refreshToken: tokens.refreshToken,
        accessToken: tokens.accessToken,
        expiresIn: tokens.expiresIn,
      });
      return res.redirect(302, `${redirectBase}?dropbox=connected`);
    } catch {
      return res.redirect(302, `${redirectBase}?dropbox=error&reason=exchange_failed`);
    }
  }

  @Get('dropbox/status')
  @UseGuards(SameOriginGuard)
  async dropboxStatus(@Req() req: Request): Promise<{ connected: boolean }> {
    if (!this.dropboxOauth.isConfigured()) return { connected: false };
    const sessionId = this.readProviderSession(req, DROPBOX_SESSION_COOKIE);
    if (!sessionId) return { connected: false };
    return { connected: await this.dropboxOauth.isConnected(sessionId) };
  }

  @Post('dropbox/disconnect')
  @UseGuards(SameOriginGuard)
  async dropboxDisconnect(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ ok: true }> {
    const sessionId = this.readProviderSession(req, DROPBOX_SESSION_COOKIE);
    if (sessionId) await this.dropboxOauth.clearTokens(sessionId);
    this.clearProviderSessionCookie(res, DROPBOX_SESSION_COOKIE);
    return { ok: true };
  }

  @Get('dropbox/files')
  @UseGuards(SameOriginGuard)
  async dropboxFiles(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const sessionId = this.requireProviderSession(
      req,
      res,
      DROPBOX_SESSION_COOKIE,
    );
    const files = await this.dropbox.listPdfFiles(sessionId);
    return { files };
  }

  @Post('dropbox/import')
  @UseGuards(SameOriginGuard)
  async dropboxImport(
    @Body() body: { fileId?: string },
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const sessionId = this.requireProviderSession(
      req,
      res,
      DROPBOX_SESSION_COOKIE,
    );
    const fileId = body?.fileId?.trim();
    if (!fileId) {
      throw new BadRequestException({
        error: 'fileId is required',
        code: ErrorCodes.VALIDATION_ERROR,
      });
    }
    const file = await this.dropbox.importFile(sessionId, fileId);
    const safeName = file.name.replace(/[^\w.\-()+ ]+/g, '_').slice(0, 160);
    return new StreamableFile(file.buffer, {
      type: file.mimeType || 'application/pdf',
      disposition: `attachment; filename="${safeName}"`,
      length: file.buffer.length,
    });
  }

  @Post('dropbox/export')
  @UseGuards(SameOriginGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_EXPORT_BYTES, files: 1 },
    }),
  )
  async dropboxExport(
    @UploadedFile(
      new ParseFilePipe({
        validators: [new MaxFileSizeValidator({ maxSize: MAX_EXPORT_BYTES })],
        fileIsRequired: true,
      }),
    )
    file: Express.Multer.File,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const sessionId = this.requireProviderSession(
      req,
      res,
      DROPBOX_SESSION_COOKIE,
    );
    return this.dropbox.exportFile(sessionId, file);
  }

  // ── OneDrive ─────────────────────────────────────────────

  @Get('onedrive/auth-url')
  @UseGuards(SameOriginGuard)
  async onedriveAuthUrl(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ url: string }> {
    this.onedriveOauth.assertConfigured();
    const sessionId = this.ensureProviderSession(
      req,
      res,
      ONEDRIVE_SESSION_COOKIE,
    );
    const url = await this.onedriveOauth.createAuthUrl(sessionId);
    return { url };
  }

  @Get('onedrive/callback')
  async onedriveCallback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') oauthError: string | undefined,
    @Res() res: Response,
  ) {
    const redirectBase = `${this.appUrl.replace(/\/$/, '')}/workspace`;
    if (oauthError || !code || !state) {
      return res.redirect(
        302,
        `${redirectBase}?onedrive=error&reason=${encodeURIComponent(oauthError || 'missing_code')}`,
      );
    }
    try {
      const sessionId = await this.onedriveOauth.consumeState(state);
      if (!sessionId) {
        return res.redirect(302, `${redirectBase}?onedrive=error&reason=invalid_state`);
      }
      this.setProviderSessionCookie(res, ONEDRIVE_SESSION_COOKIE, sessionId);
      const tokens = await this.onedriveOauth.exchangeCode(code);
      await this.onedriveOauth.storeTokens(sessionId, {
        refreshToken: tokens.refreshToken,
        accessToken: tokens.accessToken,
        expiresIn: tokens.expiresIn,
      });
      return res.redirect(302, `${redirectBase}?onedrive=connected`);
    } catch {
      return res.redirect(302, `${redirectBase}?onedrive=error&reason=exchange_failed`);
    }
  }

  @Get('onedrive/status')
  @UseGuards(SameOriginGuard)
  async onedriveStatus(@Req() req: Request): Promise<{ connected: boolean }> {
    if (!this.onedriveOauth.isConfigured()) return { connected: false };
    const sessionId = this.readProviderSession(req, ONEDRIVE_SESSION_COOKIE);
    if (!sessionId) return { connected: false };
    return { connected: await this.onedriveOauth.isConnected(sessionId) };
  }

  @Post('onedrive/disconnect')
  @UseGuards(SameOriginGuard)
  async onedriveDisconnect(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ ok: true }> {
    const sessionId = this.readProviderSession(req, ONEDRIVE_SESSION_COOKIE);
    if (sessionId) await this.onedriveOauth.clearTokens(sessionId);
    this.clearProviderSessionCookie(res, ONEDRIVE_SESSION_COOKIE);
    return { ok: true };
  }

  @Get('onedrive/files')
  @UseGuards(SameOriginGuard)
  async onedriveFiles(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const sessionId = this.requireProviderSession(
      req,
      res,
      ONEDRIVE_SESSION_COOKIE,
    );
    const files = await this.onedrive.listPdfFiles(sessionId);
    return { files };
  }

  @Post('onedrive/import')
  @UseGuards(SameOriginGuard)
  async onedriveImport(
    @Body() body: { fileId?: string },
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const sessionId = this.requireProviderSession(
      req,
      res,
      ONEDRIVE_SESSION_COOKIE,
    );
    const fileId = body?.fileId?.trim();
    if (!fileId) {
      throw new BadRequestException({
        error: 'fileId is required',
        code: ErrorCodes.VALIDATION_ERROR,
      });
    }
    const file = await this.onedrive.importFile(sessionId, fileId);
    const safeName = file.name.replace(/[^\w.\-()+ ]+/g, '_').slice(0, 160);
    return new StreamableFile(file.buffer, {
      type: file.mimeType || 'application/pdf',
      disposition: `attachment; filename="${safeName}"`,
      length: file.buffer.length,
    });
  }

  @Post('onedrive/export')
  @UseGuards(SameOriginGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_EXPORT_BYTES, files: 1 },
    }),
  )
  async onedriveExport(
    @UploadedFile(
      new ParseFilePipe({
        validators: [new MaxFileSizeValidator({ maxSize: MAX_EXPORT_BYTES })],
        fileIsRequired: true,
      }),
    )
    file: Express.Multer.File,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const sessionId = this.requireProviderSession(
      req,
      res,
      ONEDRIVE_SESSION_COOKIE,
    );
    return this.onedrive.exportFile(sessionId, file);
  }
}
