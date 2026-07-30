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
import { GoogleOAuthService } from './google-oauth.service';

const DRIVE_SESSION_COOKIE = 'drive_session';
const MAX_EXPORT_BYTES = 50 * 1024 * 1024;

@Controller('cloud')
export class CloudController {
  constructor(
    private readonly oauth: GoogleOAuthService,
    private readonly drive: DriveService,
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

      const cookieSession = this.readDriveSession(req);
      const sessionId = cookieSession || stateSession;
      this.setDriveSessionCookie(res, sessionId);

      const tokens = await this.oauth.exchangeCode(code);
      await this.oauth.storeTokens(sessionId, {
        refreshToken: tokens.refreshToken,
        accessToken: tokens.accessToken,
        expiresIn: tokens.expiresIn,
      });

      if (stateSession !== sessionId) {
        await this.oauth.storeTokens(stateSession, {
          refreshToken: tokens.refreshToken,
          accessToken: tokens.accessToken,
          expiresIn: tokens.expiresIn,
        });
      }

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
}
