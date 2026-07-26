import {
  Controller,
  Get,
  Param,
  Query,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ErrorCodes } from '@pdfnexus/shared';
import { CookieService } from '../auth/cookie.service';
import { AuthEmailService } from '../auth/auth-email.service';
import { FilesService } from './files.service';

@Controller('files')
export class FilesController {
  constructor(
    private readonly files: FilesService,
    private readonly cookies: CookieService,
    private readonly auth: AuthEmailService,
  ) {}

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

  /**
   * Resolve a ready file to its presigned URL. Defaults to a 302 redirect so
   * in-app anchors and email links behave identically; `?format=json` keeps a
   * JSON payload available for programmatic clients.
   */
  @Get(':id/download')
  async download(
    @Param('id') id: string,
    @Query('token') token: string | undefined,
    @Query('format') format: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const email = this.cookies.readVerifiedEmail(req);
    const result = await this.files.getDownload(id, email, token);
    if (format === 'json' || req.headers.accept?.includes('application/json')) {
      return res.json(result);
    }
    return res.redirect(302, result.url);
  }
}
