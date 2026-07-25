import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { emailSchema, ErrorCodes } from '@pdfnexus/shared';
import { VerifiedEmailGuard } from '../common/guards/verified-email.guard';
import { VerifiedEmail } from '../common/decorators/verified-email.decorator';
import { CookieService } from '../auth/cookie.service';
import { AuthEmailService } from '../auth/auth-email.service';
import { FilesService } from './files.service';

function clientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress || 'unknown';
}

@Controller('files')
export class FilesController {
  constructor(
    private readonly files: FilesService,
    private readonly cookies: CookieService,
    private readonly auth: AuthEmailService,
    private readonly config: ConfigService,
  ) {}

  @Post()
  @UseGuards(VerifiedEmailGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: {
        fileSize: 52_428_800,
      },
    }),
  )
  async upload(
    @VerifiedEmail() email: string,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: Request,
  ) {
    const max = this.config.get<number>('MAX_UPLOAD_BYTES') ?? 52_428_800;
    if (file && file.size > max) {
      throw new BadRequestException({
        error: 'File exceeds maximum upload size',
        code: 'FILE_TOO_LARGE',
      });
    }
    const sendEmail =
      req.body?.sendEmail === 'true' || req.body?.sendEmail === true;
    return this.files.upload(email, file, Boolean(sendEmail));
  }

  /**
   * First download: no cookie yet. Uploads the file and emails a branded
   * one-click claim link that verifies the address and downloads the file.
   */
  @Post('email-delivery')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: {
        fileSize: 52_428_800,
      },
    }),
  )
  async emailDelivery(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: Request,
  ) {
    const max = this.config.get<number>('MAX_UPLOAD_BYTES') ?? 52_428_800;
    if (file && file.size > max) {
      throw new BadRequestException({
        error: 'File exceeds maximum upload size',
        code: 'FILE_TOO_LARGE',
      });
    }

    const rawEmail = String(req.body?.email ?? '');
    const parsed = emailSchema.safeParse(rawEmail);
    if (!parsed.success) {
      throw new BadRequestException({
        error: 'Valid email is required',
        code: ErrorCodes.VALIDATION_ERROR,
      });
    }

    return this.files.uploadForEmailDelivery(
      parsed.data,
      file,
      clientIp(req),
    );
  }

  /** Magic link from email: set verified cookie, then redirect to the file. */
  @Get('claim-download')
  async claimDownload(
    @Query('token') token: string | undefined,
    @Res() res: Response,
  ) {
    if (!token) {
      throw new UnauthorizedException({
        error: 'Missing download token',
        code: ErrorCodes.AUTH_REQUIRED,
      });
    }

    const { email, redirectUrl } =
      await this.files.claimDownloadAndRedirect(token);
    await this.auth.markEmailVerified(email, res);
    return res.redirect(302, redirectUrl);
  }

  @Get(':id/download')
  async download(
    @Param('id') id: string,
    @Query('token') token: string | undefined,
    @Req() req: Request,
  ) {
    const email = this.cookies.readVerifiedEmail(req);
    return this.files.getDownload(id, email, token);
  }
}
